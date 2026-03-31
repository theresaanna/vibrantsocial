"use server";

import crypto from "crypto";
import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { isValidHexColor, THEME_COLOR_FIELDS, isPresetTheme } from "@/lib/profile-themes";
import { isValidPreset, parseJsonArray, clamp } from "@/lib/sparklefall-presets";
import { isValidFrameId } from "@/lib/profile-frames";
import { isValidFontId, getFontById } from "@/lib/profile-fonts";
import { checkAndExpirePremium } from "@/lib/premium";
import { isValidBgRepeat, isValidBgAttachment, isValidBgSize, isValidBgPosition } from "@/lib/profile-backgrounds";
import { isPresetBackgroundSrc } from "@/lib/profile-backgrounds.server";
import { invalidate, cacheKeys } from "@/lib/cache";
import { sendEmailVerificationEmail } from "@/lib/email";
import { inngest } from "@/lib/inngest";

const MAX_BIO_REVISIONS = 20;

interface ProfileState {
  success: boolean;
  message: string;
}

async function pruneOldRevisions(userId: string) {
  const count = await prisma.bioRevision.count({ where: { userId } });
  if (count > MAX_BIO_REVISIONS) {
    const toDelete = await prisma.bioRevision.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_BIO_REVISIONS,
      select: { id: true },
    });
    await prisma.bioRevision.deleteMany({
      where: { id: { in: toDelete.map((r: { id: string }) => r.id) } },
    });
  }
}

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const username = formData.get("username") as string | null;
  const displayName = formData.get("displayName") as string | null;
  const bio = formData.get("bio") as string | null;

  if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return {
      success: false,
      message:
        "Username must be 3-30 characters, letters, numbers, and underscores only",
    };
  }

  if (username) {
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "Username is already taken" };
    }
  }

  // Validate theme colors
  const themeColors: Record<string, string | null> = {};
  for (const field of THEME_COLOR_FIELDS) {
    const value = formData.get(field) as string | null;
    if (value && value.trim()) {
      if (!isValidHexColor(value.trim())) {
        return {
          success: false,
          message: `Invalid color value for ${field}. Must be a valid hex color (e.g. #ff0000).`,
        };
      }
      themeColors[field] = value.trim();
    } else {
      themeColors[field] = null;
    }
  }

  // Save current bio as a revision if it changed
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bio: true, tier: true, profileFrameId: true, suspended: true },
  });

  const isPremium = await checkAndExpirePremium(session.user.id);

  // Non-premium users can only use preset themes, not custom colors
  if (!isPremium && !isPresetTheme(themeColors)) {
    for (const field of THEME_COLOR_FIELDS) {
      themeColors[field] = null;
    }
  }

  // Validate profile frame (premium only)
  const rawFrameId = formData.get("profileFrameId") as string | null;
  let profileFrameId: string | null = null;
  if (rawFrameId && rawFrameId.trim()) {
    if (!isPremium) {
      profileFrameId = null;
    } else if (!isValidFrameId(rawFrameId.trim())) {
      return { success: false, message: "Invalid frame selection." };
    } else {
      profileFrameId = rawFrameId.trim();
    }
  }

  // Validate username font
  const rawFontId = formData.get("usernameFont") as string | null;
  let usernameFont: string | null = null;
  if (rawFontId && rawFontId.trim()) {
    if (!isValidFontId(rawFontId.trim())) {
      return { success: false, message: "Invalid font selection." };
    }
    const font = getFontById(rawFontId.trim());
    if (font && font.tier === "premium" && !isPremium) {
      usernameFont = null;
    } else {
      usernameFont = rawFontId.trim();
    }
  }

  // Validate profile background
  const rawBgImage = (formData.get("profileBgImage") as string)?.trim() || null;
  const rawBgRepeat = (formData.get("profileBgRepeat") as string)?.trim() || null;
  const rawBgAttachment = (formData.get("profileBgAttachment") as string)?.trim() || null;
  const rawBgSize = (formData.get("profileBgSize") as string)?.trim() || null;
  const rawBgPosition = (formData.get("profileBgPosition") as string)?.trim() || null;

  const bgData: Record<string, string | null> = {
    profileBgImage: null,
    profileBgRepeat: null,
    profileBgAttachment: null,
    profileBgSize: null,
    profileBgPosition: null,
  };

  if (rawBgImage) {
    const isPreset = isPresetBackgroundSrc(rawBgImage);
    const isBlobUrl = rawBgImage.includes("blob.vercel-storage.com");

    if (!isPreset && !isBlobUrl) {
      return { success: false, message: "Invalid background image." };
    }

    if (!isPremium && !isPreset) {
      bgData.profileBgImage = null;
    } else {
      bgData.profileBgImage = rawBgImage;

      if (rawBgRepeat && !isValidBgRepeat(rawBgRepeat)) {
        return { success: false, message: "Invalid background repeat value." };
      }
      if (rawBgAttachment && !isValidBgAttachment(rawBgAttachment)) {
        return { success: false, message: "Invalid background attachment value." };
      }
      if (rawBgSize && !isValidBgSize(rawBgSize)) {
        return { success: false, message: "Invalid background size value." };
      }
      if (rawBgPosition && !isValidBgPosition(rawBgPosition)) {
        return { success: false, message: "Invalid background position value." };
      }

      bgData.profileBgRepeat = rawBgRepeat;
      bgData.profileBgAttachment = rawBgAttachment;
      bgData.profileBgSize = rawBgSize;
      bgData.profileBgPosition = rawBgPosition;
    }
  }

  // Parse container opacity (0–20, available to all users)
  const rawContainerOpacity = formData.get("profileContainerOpacity");
  const profileContainerOpacity = rawContainerOpacity !== null
    ? Math.min(20, Math.max(0, Math.round(Number(rawContainerOpacity))))
    : 0;

  // Parse sparklefall settings (premium only)
  const sparklefallEnabled = formData.get("sparklefallEnabled") === "true";
  const sparklefallData: Record<string, boolean | string | number | null> = {
    sparklefallEnabled: false,
    sparklefallPreset: null,
    sparklefallSparkles: null,
    sparklefallColors: null,
    sparklefallInterval: null,
    sparklefallWind: null,
    sparklefallMaxSparkles: null,
    sparklefallMinSize: null,
    sparklefallMaxSize: null,
  };

  if (isPremium && sparklefallEnabled) {
    sparklefallData.sparklefallEnabled = true;

    const rawPreset = (formData.get("sparklefallPreset") as string)?.trim() || null;
    if (rawPreset && isValidPreset(rawPreset)) {
      sparklefallData.sparklefallPreset = rawPreset;
    }

    const rawSparkles = (formData.get("sparklefallSparkles") as string)?.trim() || null;
    if (rawSparkles && parseJsonArray(rawSparkles)) {
      sparklefallData.sparklefallSparkles = rawSparkles;
    }

    const rawColors = (formData.get("sparklefallColors") as string)?.trim() || null;
    if (rawColors && parseJsonArray(rawColors)) {
      sparklefallData.sparklefallColors = rawColors;
    }

    const rawInterval = Number(formData.get("sparklefallInterval"));
    if (!isNaN(rawInterval)) {
      sparklefallData.sparklefallInterval = clamp(rawInterval, 100, 3000);
    }

    const rawWind = Number(formData.get("sparklefallWind"));
    if (!isNaN(rawWind)) {
      sparklefallData.sparklefallWind = clamp(rawWind, -1, 1);
    }

    const rawMaxSparkles = Number(formData.get("sparklefallMaxSparkles"));
    if (!isNaN(rawMaxSparkles)) {
      sparklefallData.sparklefallMaxSparkles = clamp(rawMaxSparkles, 5, 200);
    }

    const rawMinSize = Number(formData.get("sparklefallMinSize"));
    if (!isNaN(rawMinSize)) {
      sparklefallData.sparklefallMinSize = clamp(rawMinSize, 5, 100);
    }

    const rawMaxSize = Number(formData.get("sparklefallMaxSize"));
    if (!isNaN(rawMaxSize)) {
      sparklefallData.sparklefallMaxSize = clamp(rawMaxSize, 5, 100);
    }
  }

  const newBio = bio || null;
  const oldBio = currentUser?.bio ?? null;

  if (oldBio !== null && oldBio !== newBio) {
    await prisma.bioRevision.create({
      data: { userId: session.user.id, content: oldBio },
    });
    await pruneOldRevisions(session.user.id);
  }

  // Parse birthday (month/day only)
  const rawBirthdayMonth = formData.get("birthdayMonth") as string | null;
  const rawBirthdayDay = formData.get("birthdayDay") as string | null;
  let birthdayMonth: number | null = null;
  let birthdayDay: number | null = null;

  if (rawBirthdayMonth && rawBirthdayDay) {
    const month = parseInt(rawBirthdayMonth, 10);
    const day = parseInt(rawBirthdayDay, 10);
    if (
      !isNaN(month) && !isNaN(day) &&
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31
    ) {
      // Validate day is valid for the given month (use a non-leap year)
      const maxDay = new Date(2001, month, 0).getDate();
      if (day <= maxDay) {
        birthdayMonth = month;
        birthdayDay = day;
      }
    }
  }

  const showGraphicByDefault = formData.get("showGraphicByDefault") === "true";
  const showNsfwContent = formData.get("showNsfwContent") === "true";
  const emailOnComment = formData.get("emailOnComment") === "true";
  const emailOnNewChat = formData.get("emailOnNewChat") === "true";
  const emailOnMention = formData.get("emailOnMention") === "true";
  const emailOnFriendRequest = formData.get("emailOnFriendRequest") === "true";
  const emailOnSubscribedPost = formData.get("emailOnSubscribedPost") === "true";
  const emailOnTagPost = formData.get("emailOnTagPost") === "true";
  const pushEnabled = formData.get("pushEnabled") === "true";
  let isProfilePublic = formData.get("isProfilePublic") === "true";
  const hideWallFromFeed = formData.get("hideWallFromFeed") === "true";

  // Suspended users cannot make their profile public
  if (isProfilePublic && currentUser?.suspended) {
    isProfilePublic = false;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      username: username || null,
      displayName: displayName || null,
      bio: newBio,
      showGraphicByDefault,
      showNsfwContent,
      emailOnComment,
      emailOnNewChat,
      emailOnMention,
      emailOnFriendRequest,
      emailOnSubscribedPost,
      emailOnTagPost,
      pushEnabled,
      isProfilePublic,
      hideWallFromFeed,
      birthdayMonth,
      birthdayDay,
      profileFrameId,
      usernameFont,
      ...themeColors,
      profileContainerOpacity,
      ...bgData,
      ...sparklefallData,
    },
  });

  // Invalidate cached public profile
  if (username) {
    await invalidate(cacheKeys.userProfile(username));
  }

  revalidatePath("/profile");
  if (username) {
    revalidatePath(`/${username}`);
  }
  return { success: true, message: "Profile updated" };
}

export async function removeAvatar(): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatar: true, username: true },
  });

  // Delete from Vercel Blob if it's a blob URL
  if (user?.avatar?.includes("blob.vercel-storage.com")) {
    try {
      await del(user.avatar);
    } catch {
      // Non-critical — blob cleanup failed
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: null },
  });

  if (user?.username) {
    await invalidate(cacheKeys.userProfile(user.username));
  }

  revalidatePath("/profile");
  return { success: true, message: "Avatar removed" };
}

export async function getBioRevisions() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return prisma.bioRevision.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_BIO_REVISIONS,
    select: { id: true, content: true, createdAt: true },
  });
}

interface RestoreState {
  success: boolean;
  message: string;
  restoredContent?: string;
}

export async function restoreBioRevision(
  revisionId: string
): Promise<RestoreState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const revision = await prisma.bioRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision || revision.userId !== session.user.id) {
    return { success: false, message: "Revision not found" };
  }

  // Save current bio as a revision before restoring
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bio: true },
  });

  if (currentUser?.bio) {
    await prisma.bioRevision.create({
      data: { userId: session.user.id, content: currentUser.bio },
    });
    await pruneOldRevisions(session.user.id);
  }

  const userForCache = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bio: revision.content },
  });

  if (userForCache?.username) {
    await invalidate(cacheKeys.userProfile(userForCache.username));
  }

  revalidatePath("/profile");
  return {
    success: true,
    message: "Bio restored",
    restoredContent: revision.content,
  };
}

interface EmailChangeState {
  success: boolean;
  message: string;
}

export async function requestEmailChange(
  _prevState: EmailChangeState,
  formData: FormData
): Promise<EmailChangeState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { success: false, message: "Email is required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Invalid email address" };
  }

  // Check if email is same as current
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (currentUser?.email === email) {
    return { success: false, message: "This is already your email address" };
  }

  // Check if email is already used by another user
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.id !== session.user.id) {
    return {
      success: false,
      message: "This email is already associated with another account",
    };
  }

  // Clean up any existing email verification tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: `email-verify:${email}` },
  });

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: `email-verify:${email}`,
      token,
      expires,
    },
  });

  // Set pending email on user
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingEmail: email },
  });

  // Fire-and-forget
  sendEmailVerificationEmail({ toEmail: email, token });

  revalidatePath("/profile");
  return {
    success: true,
    message: "Verification email sent! Check your inbox.",
  };
}

export async function cancelEmailChange(): Promise<EmailChangeState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pendingEmail: true },
  });

  if (user?.pendingEmail) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: `email-verify:${user.pendingEmail}` },
    });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingEmail: null },
  });

  revalidatePath("/profile");
  return { success: true, message: "Email change cancelled" };
}

export async function resendVerificationEmail(): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true, pendingEmail: true },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  // Use pending email if set, otherwise current email
  const emailToVerify = user.pendingEmail ?? user.email;

  if (!emailToVerify) {
    return { success: false, message: "No email address on file" };
  }

  if (user.emailVerified && !user.pendingEmail) {
    return { success: false, message: "Email is already verified" };
  }

  // Clean up existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: `email-verify:${emailToVerify}` },
  });

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: `email-verify:${emailToVerify}`,
      token,
      expires,
    },
  });

  // Set pendingEmail if not already set
  if (!user.pendingEmail) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { pendingEmail: emailToVerify },
    });
  }

  await sendEmailVerificationEmail({ toEmail: emailToVerify, token });

  return { success: true, message: "Verification email sent" };
}

const EMPTY_LEXICAL_CONTENT = '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}';
const BLOB_URL_REGEX = /https:\/\/[^"'\s]+\.blob\.vercel-storage\.com[^"'\s]*/g;

export async function deleteAccount(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `profile:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const confirmation = (formData.get("confirmation") as string)?.trim();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, username: true, displayName: true, avatar: true, profileBgImage: true },
  });

  if (!user || !user.username) {
    return { success: false, message: "User not found or username not set" };
  }

  const expected = `delete ${user.username}`;
  if (confirmation?.toLowerCase() !== expected.toLowerCase()) {
    return { success: false, message: "Confirmation text does not match" };
  }

  // Step 1: Collect all media blob URLs before deletion
  const blobUrls: string[] = [];

  if (user.avatar?.includes("blob.vercel-storage.com")) {
    blobUrls.push(user.avatar);
  }

  if (user.profileBgImage?.includes("blob.vercel-storage.com")) {
    blobUrls.push(user.profileBgImage);
  }

  const userPosts = await prisma.post.findMany({
    where: { authorId: user.id },
    select: { id: true, content: true },
  });

  for (const post of userPosts) {
    const matches = post.content.match(BLOB_URL_REGEX);
    if (matches) blobUrls.push(...matches);
  }

  const userMessages = await prisma.message.findMany({
    where: { senderId: user.id },
    select: { mediaUrl: true },
  });

  for (const msg of userMessages) {
    if (msg.mediaUrl?.includes("blob.vercel-storage.com")) {
      blobUrls.push(msg.mediaUrl);
    }
  }

  // Also collect blob URLs from user's quote reposts
  const userReposts = await prisma.repost.findMany({
    where: { userId: user.id, content: { not: null } },
    select: { content: true },
  });

  for (const repost of userReposts) {
    if (repost.content) {
      const matches = repost.content.match(BLOB_URL_REGEX);
      if (matches) blobUrls.push(...matches);
    }
  }

  // Step 2: Find posts quoted by other users (must be preserved as tombstones)
  const quotedPostIds = (
    await prisma.repost.findMany({
      where: {
        post: { authorId: user.id },
        content: { not: null },
        userId: { not: user.id },
      },
      select: { postId: true },
      distinct: ["postId"],
    })
  ).map((r) => r.postId);

  const quotedPostIdSet = new Set(quotedPostIds);

  // Step 3: Tombstone quoted posts
  if (quotedPostIdSet.size > 0) {
    const ids = Array.from(quotedPostIdSet);

    await prisma.post.updateMany({
      where: { id: { in: ids } },
      data: {
        content: EMPTY_LEXICAL_CONTENT,
        isAuthorDeleted: true,
        authorId: null,
        isSensitive: false,
        isNsfw: false,
        isGraphicNudity: false,
        isPinned: false,
      },
    });

    // Clean up associated data on tombstoned posts
    await Promise.all([
      prisma.like.deleteMany({ where: { postId: { in: ids } } }),
      prisma.bookmark.deleteMany({ where: { postId: { in: ids } } }),
      prisma.comment.deleteMany({ where: { postId: { in: ids } } }),
      prisma.postTag.deleteMany({ where: { postId: { in: ids } } }),
      prisma.postRevision.deleteMany({ where: { postId: { in: ids } } }),
      prisma.notification.deleteMany({ where: { postId: { in: ids } } }),
    ]);

    // Delete non-quote reposts and user's own reposts on these posts,
    // but keep quotes by other users
    await prisma.repost.deleteMany({
      where: {
        postId: { in: ids },
        OR: [{ content: null }, { userId: user.id }],
      },
    });
  }

  // Step 4: Delete all non-quoted posts (cascade handles their likes/comments/etc)
  const nonQuotedPostIds = userPosts
    .filter((p) => !quotedPostIdSet.has(p.id))
    .map((p) => p.id);

  if (nonQuotedPostIds.length > 0) {
    await prisma.post.deleteMany({
      where: { id: { in: nonQuotedPostIds } },
    });
  }

  // Step 5: Archive user data
  await prisma.deletedUser.create({
    data: {
      originalId: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    },
  });

  // Step 6: Delete the user (cascades remaining relations)
  await prisma.user.delete({ where: { id: user.id } });

  // Step 7: Queue media cleanup job
  const uniqueUrls = [...new Set(blobUrls)];
  if (uniqueUrls.length > 0) {
    await inngest.send({
      name: "user/delete-media",
      data: { blobUrls: uniqueUrls, originalUserId: user.id },
    });
  }

  return { success: true, message: "Account deleted" };
}
