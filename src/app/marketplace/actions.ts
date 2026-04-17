"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { revalidatePath, updateTag } from "next/cache";
import { MARKETPLACE_FEED_TAG } from "./media-actions";
import {
  extractMentionsFromLexicalJson,
  createMentionNotifications,
} from "@/lib/mentions";
import { extractTagsFromNames } from "@/lib/tags";
import { invalidate, cacheKeys } from "@/lib/cache";
import { generateSlugFromContent, validateSlug } from "@/lib/slugs";
import { inngest } from "@/lib/inngest";
import { awardReferralFirstPostBonus, checkStarsMilestone } from "@/lib/referral";
import { getAblyRestClient } from "@/lib/ably";
import type { ShippingOption } from "@/generated/prisma/client";
import crypto from "crypto";

const MAX_DIGITAL_FILE_SIZE = 200 * 1024 * 1024; // 200MB

interface MarketplacePostState {
  success: boolean;
  message: string;
  postId?: string;
  slug?: string;
}

async function resolveUniqueSlug(
  authorId: string,
  baseSlug: string,
  excludePostId?: string
): Promise<string> {
  if (!baseSlug) baseSlug = "post";

  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.post.findFirst({
      where: {
        authorId,
        slug: candidate,
        ...(excludePostId ? { id: { not: excludePostId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix++;
    candidate = `${baseSlug}-${suffix}`;
  }
}

const VALID_SHIPPING_OPTIONS: ShippingOption[] = [
  "FREE",
  "FLAT_RATE",
  "CONTACT_SELLER",
];

function isValidShippingOption(value: string): value is ShippingOption {
  return VALID_SHIPPING_OPTIONS.includes(value as ShippingOption);
}

export async function createMarketplacePost(
  _prevState: MarketplacePostState,
  formData: FormData
): Promise<MarketplacePostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `marketplace:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const isNotSuspended = await requireNotSuspended(session.user.id);
  if (!isNotSuspended) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to post" };
  }

  const isOldEnough = await requireMinimumAge(session.user.id, 18);
  if (!isOldEnough) {
    return { success: false, message: "You must be 18 or older to post" };
  }

  const content = formData.get("content") as string;
  if (!content) {
    return { success: false, message: "Post content is required" };
  }

  try {
    const parsed = JSON.parse(content);
    const text = JSON.stringify(parsed);
    if (text.length < 50) {
      return { success: false, message: "Post cannot be empty" };
    }
  } catch {
    return { success: false, message: "Invalid post content" };
  }

  // Marketplace-specific fields
  const purchaseUrl = formData.get("purchaseUrl") as string;
  if (!purchaseUrl?.trim()) {
    return { success: false, message: "Purchase URL is required" };
  }

  try {
    new URL(purchaseUrl);
  } catch {
    return { success: false, message: "Invalid purchase URL" };
  }

  const priceStr = formData.get("price") as string;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) {
    return { success: false, message: "Valid price is required" };
  }

  const shippingOptionRaw = formData.get("shippingOption") as string;
  const shippingOption: ShippingOption = isValidShippingOption(shippingOptionRaw)
    ? shippingOptionRaw
    : "CONTACT_SELLER";

  const shippingPriceStr = formData.get("shippingPrice") as string;
  const shippingPrice = shippingPriceStr ? parseFloat(shippingPriceStr) : null;

  const agreedToTerms = formData.get("agreedToTerms") === "true";
  if (!agreedToTerms) {
    return { success: false, message: "You must agree to the marketplace terms" };
  }

  const isNsfw = formData.get("isNsfw") === "true";
  const isGraphicNudity = formData.get("isGraphicNudity") === "true";

  // Age verification required for graphic/explicit content
  if (isGraphicNudity) {
    const poster = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ageVerified: true },
    });
    if (!poster?.ageVerified) {
      return { success: false, message: "Age verification required to post graphic/explicit content" };
    }
  }

  // Slug
  const rawSlug = formData.get("slug") as string;
  let slug: string;
  if (rawSlug?.trim()) {
    slug = validateSlug(rawSlug);
    if (!slug) {
      return { success: false, message: "Invalid slug format" };
    }
  } else {
    slug = generateSlugFromContent(content);
  }
  slug = await resolveUniqueSlug(session.user.id, slug);

  const hideLinkPreview = formData.get("hideLinkPreview") === "true";

  const post = await prisma.post.create({
    data: {
      content,
      slug,
      authorId: session.user.id,
      isNsfw,
      isGraphicNudity,
      hideLinkPreview,
      isSensitive: false,
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      isLoggedInOnly: false,
    },
  });

  const promotedToFeed = formData.get("promotedToFeed") === "true";
  const publicListing = formData.get("publicListing") === "true";

  const marketplacePost = await prisma.marketplacePost.create({
    data: {
      postId: post.id,
      purchaseUrl: purchaseUrl.trim(),
      price,
      shippingOption,
      shippingPrice: shippingOption === "FLAT_RATE" ? shippingPrice : null,
      promotedToFeed,
      publicListing,
      agreedToTerms: true,
    },
  });

  // Attach digital file if provided
  const digitalFileUrl = formData.get("digitalFileUrl") as string;
  const digitalFileName = formData.get("digitalFileName") as string;
  const digitalFileSizeStr = formData.get("digitalFileSize") as string;
  const digitalFileIsFree = formData.get("digitalFileIsFree") !== "false";

  if (digitalFileUrl?.trim() && digitalFileName?.trim() && digitalFileSizeStr) {
    const digitalFileSize = parseInt(digitalFileSizeStr, 10);
    if (digitalFileSize > 0 && digitalFileSize <= MAX_DIGITAL_FILE_SIZE) {
      await prisma.digitalFile.create({
        data: {
          marketplacePostId: marketplacePost.id,
          fileUrl: digitalFileUrl.trim(),
          fileName: digitalFileName.trim(),
          fileSize: digitalFileSize,
          isFree: digitalFileIsFree,
          couponCode: digitalFileIsFree
            ? null
            : crypto.randomBytes(6).toString("hex").toUpperCase(),
        },
      });
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { stars: { increment: 1 } },
  });

  await awardReferralFirstPostBonus(session.user.id);
  await checkStarsMilestone(session.user.id);

  // Attach tags (skip for graphic posts; NSFW posts can have tags)
  const rawTags = formData.get("tags") as string;
  if (rawTags && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags.split(","));
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.postTag.create({
        data: { postId: post.id, tagId: tag.id },
      });
    }
    if (isNsfw) {
      await invalidate(cacheKeys.nsfwTagCloud());
    } else {
      await invalidate(cacheKeys.tagCloud());
    }
    await Promise.all(
      tagNames.map((name) => invalidate(cacheKeys.tagPostCount(name)))
    );
  }

  // Send mention notifications
  const mentionedUsernames = extractMentionsFromLexicalJson(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({
      usernames: mentionedUsernames,
      actorId: session.user.id,
      postId: post.id,
    });
  }

  // Trigger content moderation scan
  await inngest.send({
    name: "moderation/scan-post",
    data: { postId: post.id, userId: session.user.id },
  });

  if (promotedToFeed) {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`feed:${session.user.id}`);
    await channel.publish("new-post", { postId: post.id });
  }

  updateTag(MARKETPLACE_FEED_TAG);
  revalidatePath("/marketplace");
  return { success: true, message: "Marketplace post created", postId: post.id, slug: post.slug ?? undefined };
}

export async function promoteToFeed(postId: string): Promise<MarketplacePostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { marketplacePost: true },
  });

  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  if (!post.marketplacePost) {
    return { success: false, message: "Not a marketplace post" };
  }

  await prisma.marketplacePost.update({
    where: { id: post.marketplacePost.id },
    data: { promotedToFeed: !post.marketplacePost.promotedToFeed },
  });

  updateTag(MARKETPLACE_FEED_TAG);
  revalidatePath("/feed");
  revalidatePath("/marketplace");
  return {
    success: true,
    message: post.marketplacePost.promotedToFeed ? "Removed from feed" : "Promoted to feed",
  };
}

export async function deleteMarketplacePost(
  _prevState: MarketplacePostState,
  formData: FormData
): Promise<MarketplacePostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `marketplace:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const postId = formData.get("postId") as string;
  if (!postId) {
    return { success: false, message: "Post ID required" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  const postTags = await prisma.postTag.findMany({
    where: { postId },
    include: { tag: { select: { name: true } } },
  });

  await prisma.post.delete({ where: { id: postId } });

  if (postTags.length > 0) {
    await invalidate(cacheKeys.tagCloud());
    await Promise.all(
      postTags.map((pt) => invalidate(cacheKeys.tagPostCount(pt.tag.name)))
    );
  }

  updateTag(MARKETPLACE_FEED_TAG);
  revalidatePath("/marketplace");
  return { success: true, message: "Post deleted" };
}
