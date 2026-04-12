/**
 * Generic RPC route for read-only server functions.
 *
 * Client components should call server functions through this endpoint
 * (via the `callRpc` helper) instead of invoking server actions directly
 * whenever the call happens *automatically* (timers, effects, scroll
 * observers, debounced inputs, etc.).
 *
 * Why: server action responses include RSC "flight data" for the current
 * page. When an in-flight action resolves after the user has navigated
 * away, the stale flight data causes the router to briefly flash the
 * previous page. Plain JSON from a route handler has no flight data.
 */
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { withMobileSession } from "@/lib/mobile-session-context";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

import { searchUsers, searchPosts, searchTagsForSearch, searchMarketplacePosts } from "@/app/search/actions";
import { fetchNewFeedItems, fetchSinglePost, fetchFeedPage, fetchCloseFriendsFeedPage } from "@/app/feed/feed-actions";
import { fetchForYouPage } from "@/app/feed/for-you-actions";
import { fetchFeedSummary, generateFeedSummaryOnDemand } from "@/app/feed/summary-actions";
import {
  fetchNewListFeedItems, fetchListFeedPage, getUserLists, getSubscribedLists,
  getCollaboratingLists, getListMembers, searchUsersForList, getListCollaborators,
  searchUsersForCollaborator, isSubscribedToList,
} from "@/app/lists/actions";
import {
  getConversations,
  getMessages,
  getConversationDetails,
  getMessageRequests,
  startConversation,
  createGroupConversation,
  sendMessage,
  deleteMessage,
  markConversationRead,
  acceptMessageRequest,
  declineMessageRequest,
} from "@/app/chat/actions";
import { getUnreadNotificationCount, getRecentNotifications } from "@/app/notifications/actions";
import { fetchNewcomers } from "@/app/communities/newcomer-actions";
import { fetchTopDiscussedPosts } from "@/app/communities/discussion-actions";
import { fetchCommunitiesMediaPage } from "@/app/communities/media-actions";
import { fetchSpotlightUsers } from "@/app/communities/spotlight-actions";
import { fetchAllUserLists } from "@/app/communities/user-lists-actions";
import { pollStatuses, getFriendStatuses, getUserStatusHistory, setStatusAndReturn, toggleStatusLike, deleteStatus } from "@/app/feed/status-actions";
import { fetchMediaFeedPage } from "@/app/feed/media-actions";
import { recordPostView } from "@/app/feed/view-actions";
import { fetchComments, toggleCommentReaction, createComment } from "@/app/feed/post-actions";
import { getBlockedUsers, getMutedUsers, toggleBlock, toggleMute } from "@/app/feed/block-actions";
import { beginTOTPSetup, confirmTOTPSetup, disableTwoFactor } from "@/app/profile/two-factor-actions";
import { updateProfile } from "@/app/profile/actions";
import { getPostsByTag } from "@/app/tags/actions";
import { toggleTagSubscription, getTagSubscriptionStatus } from "@/app/feed/tag-subscription-actions";
import { getQuestions, askQuestion, answerQuestion, deleteQuestion } from "@/app/marketplace/qa-actions";
import { downloadFreeFile, redeemCouponAndDownload, fetchDigitalFileInfo } from "@/app/marketplace/digital-file-actions";
import { createMarketplacePost } from "@/app/marketplace/actions";
import { createWallPost, deleteWallPost } from "@/app/feed/wall-post-actions";
import { getCloseFriends, addCloseFriend, removeCloseFriend, getAcceptedFriends } from "@/app/feed/close-friends-actions";
import { updateLinksPage } from "@/app/profile/links/actions";
import { submitReport } from "@/app/report/actions";
import { deletePost } from "@/app/feed/actions";
import { createPremiumSubscription, createBillingPortal } from "@/app/premium/actions";
import { updateTheme } from "@/app/theme/actions";
import { isValidHexColor, THEME_COLOR_FIELDS } from "@/lib/profile-themes";
import { getProfileBackgrounds } from "@/lib/profile-backgrounds.server";

// Mobile-friendly wrappers for FormData-based actions
async function mobileToggleBlock(userId: string) {
  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("blockByPhone", "false");
  return toggleBlock({ success: false, message: "" }, formData);
}

async function mobileToggleMute(userId: string) {
  const formData = new FormData();
  formData.set("userId", userId);
  return toggleMute(formData);
}

async function mobileCreateComment(data: { postId: string; content: string; parentId?: string; imageUrl?: string }) {
  const formData = new FormData();
  formData.set("postId", data.postId);
  formData.set("content", data.content);
  if (data.parentId) formData.set("parentId", data.parentId);
  if (data.imageUrl) formData.set("imageUrl", data.imageUrl);
  return createComment({ success: false, message: "" }, formData);
}

async function mobileUpdateProfile(data: Record<string, string | null>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      formData.set(key, value);
    }
  }
  return updateProfile({ success: false, message: "" }, formData);
}

async function mobileToggleTagSubscription(tagId: string) {
  const formData = new FormData();
  formData.set("tagId", tagId);
  return toggleTagSubscription({ success: false, message: "" }, formData);
}

async function mobileAddCloseFriend(friendId: string) {
  const formData = new FormData();
  formData.set("friendId", friendId);
  return addCloseFriend({ success: false, message: "" }, formData);
}

async function mobileRemoveCloseFriend(friendId: string) {
  const formData = new FormData();
  formData.set("friendId", friendId);
  return removeCloseFriend({ success: false, message: "" }, formData);
}

async function mobileCreateStatus(content: string) {
  return setStatusAndReturn(content);
}

async function mobileToggleStatusLike(statusId: string) {
  const formData = new FormData();
  formData.set("statusId", statusId);
  return toggleStatusLike({ success: false, message: "" }, formData);
}

async function mobileDeleteStatus(statusId: string) {
  const formData = new FormData();
  formData.set("statusId", statusId);
  return deleteStatus({ success: false, message: "" }, formData);
}

async function mobileReplyToStatus(userId: string, message: string) {
  return startConversation(userId);
}

async function mobileCreateMarketplaceListing(data: {
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  condition: string;
  tags: string[];
  media: { url: string; type: string }[];
  digitalFile?: { url: string; fileName: string; fileSize: number; isFree: boolean };
}) {
  const formData = new FormData();

  // Build Lexical JSON content from title + description + media
  const children: any[] = [];
  // Title paragraph
  children.push({
    children: [{ detail: 0, format: 1, mode: "normal", style: "", text: data.title, type: "text", version: 1 }],
    direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1,
  });
  // Description paragraph
  children.push({
    children: [{ detail: 0, format: 0, mode: "normal", style: "", text: data.description, type: "text", version: 1 }],
    direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1,
  });
  // Embed images as image nodes
  for (const m of data.media || []) {
    if (m.type === "image") {
      children.push({
        altText: data.title, height: 0, maxWidth: 800, src: m.url, width: 0,
        type: "image", version: 1,
      });
    }
  }

  const lexicalContent = JSON.stringify({
    root: { children, direction: "ltr", format: "", indent: 0, type: "root", version: 1 },
  });

  formData.set("content", lexicalContent);
  formData.set("price", String(data.price));
  formData.set("purchaseUrl", "https://vibrantsocial.app/marketplace");
  formData.set("shippingOption", "CONTACT_SELLER");
  formData.set("agreedToTerms", "true");
  if (data.tags?.length) {
    formData.set("tags", data.tags.join(","));
  }

  return createMarketplacePost({ success: false, message: "" }, formData);
}

async function mobileFetchMarketplacePost(postId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          image: true,
          profileFrameId: true,
        },
      },
      marketplacePost: {
        include: {
          digitalFile: true,
        },
      },
    },
  });

  if (!post || !post.author || !post.marketplacePost) return null;

  // Extract media from Lexical content
  let media: { url: string; type: string }[] = [];
  try {
    const parsed = JSON.parse(post.content);
    media = extractMediaFromNode(parsed);
  } catch {}

  // Get digital file info
  let digitalFile = undefined;
  if (post.marketplacePost.digitalFile) {
    const df = post.marketplacePost.digitalFile;
    const isOwner = session?.user?.id === post.author.id;
    digitalFile = {
      hasFile: true,
      fileName: df.fileName,
      fileSize: df.fileSize,
      isFree: df.isFree,
      downloadCount: isOwner ? df.downloadCount : undefined,
      isOwner,
    };
  }

  // Extract text description
  let description = "";
  try {
    const parsed = JSON.parse(post.content);
    description = extractTextFromLexical(parsed);
  } catch {}

  return {
    id: post.id,
    title: description.slice(0, 100),
    description,
    price: post.marketplacePost.price,
    createdAt: post.createdAt.toISOString(),
    marketplacePostId: post.marketplacePost.id,
    media,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.displayName,
      avatar: post.author.avatar ?? post.author.image,
      profileFrameId: post.author.profileFrameId,
    },
    digitalFile,
  };
}

function extractMediaFromNode(node: any): { url: string; type: string }[] {
  const results: { url: string; type: string }[] = [];
  if (!node) return results;
  if (node.type === "image" && node.src) {
    results.push({ url: node.src, type: "image" });
  }
  if (node.type === "video" && node.src) {
    results.push({ url: node.src, type: "video" });
  }
  if (node.children) {
    for (const child of node.children) {
      results.push(...extractMediaFromNode(child));
    }
  }
  return results;
}

async function mobileCreateWallPost(data: { wallOwnerId: string; content: string }) {
  const formData = new FormData();
  formData.set("wallOwnerId", data.wallOwnerId);
  // Wrap plain text content in minimal Lexical JSON for the server action
  const lexicalContent = JSON.stringify({
    root: {
      children: [{
        children: [{ detail: 0, format: 0, mode: "normal", style: "", text: data.content, type: "text", version: 1 }],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      }],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
  formData.set("content", lexicalContent);
  return createWallPost({ success: false, message: "" }, formData);
}

async function mobileDeleteWallPost(wallPostId: string) {
  const formData = new FormData();
  formData.set("wallPostId", wallPostId);
  return deleteWallPost({ success: false, message: "" }, formData);
}

async function mobileGetWallPosts(wallOwnerId: string) {
  const { prisma } = await import("@/lib/prisma");
  const wallPosts = await prisma.wallPost.findMany({
    where: {
      wallOwnerId,
      status: "accepted",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              image: true,
            },
          },
        },
      },
    },
  });

  return wallPosts.map((wp: any) => {
    // Try to extract plain text from Lexical JSON content
    let textContent = "";
    try {
      const parsed = JSON.parse(wp.post.content);
      textContent = extractTextFromLexical(parsed);
    } catch {
      textContent = wp.post.content || "";
    }

    return {
      id: wp.id,
      content: textContent,
      createdAt: wp.createdAt.toISOString(),
      author: {
        id: wp.post.author.id,
        username: wp.post.author.username,
        displayName: wp.post.author.displayName,
        avatar: wp.post.author.avatar ?? wp.post.author.image,
      },
    };
  });
}

function extractTextFromLexical(node: any): string {
  if (!node) return "";
  if (node.text) return node.text;
  if (node.children) {
    return node.children.map((c: any) => extractTextFromLexical(c)).join(node.type === "root" ? "\n" : "");
  }
  return "";
}

async function mobileReportContent(data: {
  contentType: string;
  contentId: string;
  category: string;
  description: string;
}) {
  const formData = new FormData();
  formData.set("contentType", data.contentType);
  formData.set("contentId", data.contentId);
  formData.set("category", data.category);
  formData.set("description", data.description);
  return submitReport({ success: false, message: "" }, formData);
}

async function mobileDeletePost(postId: string) {
  const formData = new FormData();
  formData.set("postId", postId);
  return deletePost({ success: false, message: "" }, formData);
}

async function mobileCreateMobileCheckout() {
  return createPremiumSubscription();
}

async function mobileCreateBillingPortalSession() {
  return createBillingPortal();
}

async function mobileGetUserStatuses(username: string, limit = 30) {
  return getUserStatusHistory(username, limit);
}

async function mobileGetFriendStatuses(limit = 20) {
  return getFriendStatuses(limit);
}

async function mobileGetTagInfo(tagName: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const normalized = tagName.toLowerCase();
  const tag = await prisma.tag.findUnique({
    where: { name: normalized },
    select: {
      id: true,
      name: true,
      _count: { select: { posts: true, subscriptions: true } },
    },
  });
  if (!tag) return null;
  const session = await auth();
  let subscribed = false;
  if (session?.user?.id) {
    const sub = await prisma.tagSubscription.findUnique({
      where: { userId_tagId: { userId: session.user.id, tagId: tag.id } },
    });
    subscribed = !!sub;
  }
  return {
    id: tag.id,
    name: tag.name,
    postCount: tag._count.posts,
    subscriberCount: tag._count.subscriptions,
    subscribed,
  };
}

async function mobileGetTagSubscriptions() {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { subscriptions: [] };
  const subs = await prisma.tagSubscription.findMany({
    where: { userId: session.user.id },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          _count: { select: { posts: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    subscriptions: subs.map((s: { tag: { id: string; name: string; _count: { posts: number } } }) => ({
      tagId: s.tag.id,
      tagName: s.tag.name,
      postCount: s.tag._count.posts,
    })),
  };
}

async function mobileGetProfileLinks() {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      linksPageEnabled: true,
      linksPageBio: true,
      linksPageSensitiveLinks: true,
      linksPageLinks: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, url: true },
      },
    },
  });
  return user;
}

async function mobileUpdateProfileLinks(data: {
  enabled: boolean;
  bio: string;
  sensitiveLinks: boolean;
  links: { title: string; url: string }[];
}) {
  const formData = new FormData();
  if (data.enabled) formData.set("linksPageEnabled", "on");
  if (data.sensitiveLinks) formData.set("linksPageSensitiveLinks", "on");
  formData.set("linksPageBio", data.bio || "");
  for (const link of data.links) {
    formData.append("linkTitle", link.title);
    formData.append("linkUrl", link.url);
  }
  return updateLinksPage({ success: false, message: "" }, formData);
}

async function mobileGetUserProfileLinks(username: string) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      linksPageEnabled: true,
      linksPageBio: true,
      linksPageLinks: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, url: true },
      },
    },
  });
  if (!user || !user.linksPageEnabled) return null;
  return user;
}

async function mobileSendEmailVerification() {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const { randomBytes } = await import("crypto");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user?.email) return { success: false, message: "No email address on account" };
  if (user.emailVerified) return { success: false, message: "Email already verified" };

  const code = randomBytes(3).toString("hex").toUpperCase(); // 6-char code
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await prisma.verificationToken.create({
    data: { identifier: user.email, token: code, expires },
  });

  // In production, send email here via email service
  console.log(`[email-verify] Code for ${user.email}: ${code}`);
  return { success: true };
}

async function mobileVerifyEmail(code: string) {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user?.email) return { success: false, message: "No email on account" };

  const token = await prisma.verificationToken.findFirst({
    where: { identifier: user.email, token: code, expires: { gt: new Date() } },
  });
  if (!token) return { success: false, message: "Invalid or expired code" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: token.identifier, token: token.token } },
  });

  return { success: true, message: "Email verified" };
}

async function mobileSendPhoneVerification(phone: string) {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  if (!phone || phone.length < 10) return { success: false, message: "Invalid phone number" };

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.verificationToken.create({
    data: { identifier: `phone:${phone}`, token: code, expires },
  });

  // In production, send SMS here via SMS service
  console.log(`[phone-verify] Code for ${phone}: ${code}`);
  return { success: true };
}

async function mobileVerifyPhone(phone: string, code: string) {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const token = await prisma.verificationToken.findFirst({
    where: { identifier: `phone:${phone}`, token: code, expires: { gt: new Date() } },
  });
  if (!token) return { success: false, message: "Invalid or expired code" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phoneNumber: phone, phoneVerified: new Date() },
  });
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: token.identifier, token: token.token } },
  });

  return { success: true, message: "Phone verified" };
}

async function mobileSubmitSupportRequest(data: { subject: string; message: string }) {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  if (!data.subject?.trim() || !data.message?.trim()) {
    return { success: false, message: "Subject and message are required" };
  }

  await prisma.supportRequest.create({
    data: {
      userId: session.user.id,
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: "open",
    },
  });

  return { success: true, message: "Support request submitted" };
}

async function mobileSubmitAppeal(data: { reason: string; details: string }) {
  const { auth } = await import("@/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  if (!data.reason?.trim() || !data.details?.trim()) {
    return { success: false, message: "Reason and details are required" };
  }

  await prisma.appeal.create({
    data: {
      userId: session.user.id,
      type: data.reason.trim(),
      reason: data.details.trim(),
      status: "pending",
    },
  });

  return { success: true, message: "Appeal submitted" };
}

// ── Profile & Theme RPC wrappers ──────────────────────────────────────

const profileThemeSelect = {
  profileBgColor: true,
  profileTextColor: true,
  profileLinkColor: true,
  profileSecondaryColor: true,
  profileContainerColor: true,
  profileContainerOpacity: true,
  profileBgImage: true,
  profileBgRepeat: true,
  profileBgAttachment: true,
  profileBgSize: true,
  profileBgPosition: true,
  sparklefallEnabled: true,
  sparklefallPreset: true,
  sparklefallSparkles: true,
  sparklefallColors: true,
  sparklefallInterval: true,
  sparklefallWind: true,
  sparklefallMaxSparkles: true,
  sparklefallMinSize: true,
  sparklefallMaxSize: true,
} as const;

async function mobileGetProfile(username: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      bio: true,
      avatar: true,
      image: true,
      tier: true,
      profileFrameId: true,
      usernameFont: true,
      ...profileThemeSelect,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) return null;

  const session = await auth();
  const currentUserId = session?.user?.id;

  // Compute friendship / follow status
  let isFollowing = false;
  let isFriend = false;
  let friendRequestStatus: "none" | "sent" | "received" | "accepted" = "none";
  let friendsCount = 0;

  if (currentUserId && currentUserId !== user.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUserId, followingId: user.id } },
    });
    isFollowing = !!follow;

    // Check friend request status
    const sentRequest = await prisma.friendRequest.findFirst({
      where: { senderId: currentUserId, receiverId: user.id },
    });
    const receivedRequest = await prisma.friendRequest.findFirst({
      where: { senderId: user.id, receiverId: currentUserId },
    });

    if (sentRequest?.status === "ACCEPTED" || receivedRequest?.status === "ACCEPTED") {
      isFriend = true;
      friendRequestStatus = "accepted";
    } else if (sentRequest && sentRequest.status === "PENDING") {
      friendRequestStatus = "sent";
    } else if (receivedRequest && receivedRequest.status === "PENDING") {
      friendRequestStatus = "received";
    }
  }

  // Count accepted friendships
  friendsCount = await prisma.friendRequest.count({
    where: {
      OR: [{ senderId: user.id }, { receiverId: user.id }],
      status: "ACCEPTED",
    },
  });

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.name,
    bio: user.bio,
    avatar: user.avatar ?? user.image,
    backgroundUrl: user.profileBgImage,
    tier: user.tier,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    friendsCount,
    postsCount: user._count.posts,
    isFollowing,
    isFriend,
    friendRequestStatus,
    profileFrameId: user.profileFrameId,
    profileFontId: user.usernameFont,
    // Theme fields
    profileBgColor: user.profileBgColor,
    profileTextColor: user.profileTextColor,
    profileLinkColor: user.profileLinkColor,
    profileSecondaryColor: user.profileSecondaryColor,
    profileContainerColor: user.profileContainerColor,
    profileContainerOpacity: user.profileContainerOpacity,
    profileBgImage: user.profileBgImage,
    sparklefallEnabled: user.sparklefallEnabled,
    sparklefallPreset: user.sparklefallPreset,
  };
}

async function mobileGetProfileCustomization() {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      displayName: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      usernameFont: true,
      sparklefallEnabled: true,
      sparklefallPreset: true,
      profileBgColor: true,
    },
  });

  if (!user) return null;

  return {
    profileFrameId: user.profileFrameId,
    profileFontId: user.usernameFont,
    sparklefallEnabled: user.sparklefallEnabled,
    sparklefallPreset: user.sparklefallPreset,
    profileBgColor: user.profileBgColor,
    avatar: user.avatar ?? user.image,
    displayName: user.displayName,
    username: user.username,
  };
}

async function mobileGetUserTheme() {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      displayName: true,
      avatar: true,
      image: true,
      ...profileThemeSelect,
    },
  });

  if (!user) return null;

  return {
    displayName: user.displayName,
    username: user.username,
    avatar: user.avatar ?? user.image,
    sparklefallEnabled: user.sparklefallEnabled,
    sparklefallPreset: user.sparklefallPreset,
    sparklefallSparkles: user.sparklefallSparkles,
    sparklefallColors: user.sparklefallColors,
    sparklefallInterval: user.sparklefallInterval,
    sparklefallWind: user.sparklefallWind,
    sparklefallMaxSparkles: user.sparklefallMaxSparkles,
    sparklefallMinSize: user.sparklefallMinSize,
    sparklefallMaxSize: user.sparklefallMaxSize,
    profileBgColor: user.profileBgColor,
    profileTextColor: user.profileTextColor,
    profileLinkColor: user.profileLinkColor,
    profileSecondaryColor: user.profileSecondaryColor,
    profileContainerColor: user.profileContainerColor,
    profileContainerOpacity: user.profileContainerOpacity,
    profileBgImage: user.profileBgImage,
    profileBgRepeat: user.profileBgRepeat,
    profileBgSize: user.profileBgSize,
    profileBgPosition: user.profileBgPosition,
  };
}

async function mobileSaveTheme(data: Record<string, string | number | null>) {
  const formData = new FormData();
  for (const field of THEME_COLOR_FIELDS) {
    const value = data[field];
    if (value && typeof value === "string") {
      formData.set(field, value);
    }
  }
  if (data.profileContainerOpacity !== undefined && data.profileContainerOpacity !== null) {
    formData.set("profileContainerOpacity", String(data.profileContainerOpacity));
  }
  if (data.profileBgImage && typeof data.profileBgImage === "string") {
    formData.set("profileBgImage", data.profileBgImage);
  }
  // Pass through sparklefall settings unchanged
  formData.set("sparklefallEnabled", "false");
  return updateTheme({ success: false, message: "" }, formData);
}

async function mobileGetBackgroundPresets() {
  const backgrounds = getProfileBackgrounds();
  // Background src paths are relative (e.g. /backgrounds/foo.jpg).
  // The mobile app can prepend the API base URL to form full URLs,
  // but we return them as-is since they are used as profileBgImage
  // values that the server stores and the web app also uses as-is.
  return backgrounds.map((bg) => ({
    id: bg.id,
    name: bg.name,
    src: bg.src,
    thumbSrc: bg.thumbSrc,
    category: bg.category,
  }));
}

async function mobileUpdateProfileCustomization(data: Record<string, string | boolean | null>) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const updateData: Record<string, string | boolean | null> = {};
  if ("profileFrameId" in data) updateData.profileFrameId = data.profileFrameId as string | null;
  if ("profileFontId" in data) updateData.usernameFont = data.profileFontId as string | null;
  if ("sparklefallEnabled" in data) updateData.sparklefallEnabled = Boolean(data.sparklefallEnabled);
  if ("sparklefallPreset" in data) updateData.sparklefallPreset = data.sparklefallPreset as string | null;
  if ("profileBgColor" in data) updateData.profileBgColor = data.profileBgColor as string | null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return { success: true, message: "Profile updated" };
}

// ── Mobile List Management ─────────────────────────────────────────

// ── Mobile List Management ─────────────────────────────────────────

async function mobileGetCollaboratingLists() {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return [];

  const lists = await prisma.userList.findMany({
    where: {
      collaborators: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { members: true } },
      owner: { select: { username: true, displayName: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return JSON.parse(JSON.stringify(lists));
}

async function mobileCreateList(name: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 50) {
    return { success: false, message: "List name must be between 1 and 50 characters" };
  }

  const existing = await prisma.userList.findUnique({
    where: { ownerId_name: { ownerId: session.user.id, name: trimmed } },
  });
  if (existing) {
    return { success: false, message: "You already have a list with that name" };
  }

  const list = await prisma.userList.create({
    data: { name: trimmed, ownerId: session.user.id },
  });

  await invalidate(cacheKeys.userLists(session.user.id));
  return { success: true, message: "List created", listId: list.id };
}

async function mobileDeleteList(listId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  await prisma.userList.delete({ where: { id: listId } });
  await Promise.all([
    invalidate(cacheKeys.userLists(session.user.id)),
    invalidate(cacheKeys.userListMembers(listId)),
  ]);

  return { success: true, message: "List deleted" };
}

async function mobileRenameList(listId: string, name: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 50) {
    return { success: false, message: "List name must be between 1 and 50 characters" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  const duplicate = await prisma.userList.findUnique({
    where: { ownerId_name: { ownerId: session.user.id, name: trimmed } },
  });
  if (duplicate && duplicate.id !== listId) {
    return { success: false, message: "You already have a list with that name" };
  }

  await prisma.userList.update({ where: { id: listId }, data: { name: trimmed } });
  await invalidate(cacheKeys.userLists(session.user.id));
  return { success: true, message: "List renamed" };
}

async function mobileToggleListPrivacy(listId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  const newPrivacy = !list.isPrivate;
  await prisma.userList.update({ where: { id: listId }, data: { isPrivate: newPrivacy } });
  await invalidate(cacheKeys.userLists(session.user.id));
  return { success: true, message: newPrivacy ? "List is now private" : "List is now public", isPrivate: newPrivacy };
}

async function mobileAddMemberToList(listId: string, userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  // Check permission
  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) return { success: false, message: "List not found" };
  const isOwner = list.ownerId === session.user.id;
  const collab = !isOwner ? await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  }) : null;
  if (!isOwner && !collab) return { success: false, message: "You don't have permission" };

  const existing = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (existing) return { success: false, message: "User is already in this list" };

  await prisma.userListMember.create({ data: { listId, userId } });
  await invalidate(cacheKeys.userListMembers(listId));
  return { success: true, message: "Member added" };
}

async function mobileRemoveMemberFromList(listId: string, userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) return { success: false, message: "List not found" };
  const isOwner = list.ownerId === session.user.id;
  const collab = !isOwner ? await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  }) : null;
  if (!isOwner && !collab) return { success: false, message: "You don't have permission" };

  const member = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (!member) return { success: false, message: "User is not in this list" };

  await prisma.userListMember.delete({ where: { id: member.id } });
  await invalidate(cacheKeys.userListMembers(listId));
  return { success: true, message: "Member removed" };
}

async function mobileAddCollaboratorToList(listId: string, userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "Only the list owner can add collaborators" };
  }

  if (userId === session.user.id) return { success: false, message: "Cannot add yourself" };

  const existing = await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (existing) return { success: false, message: "User is already a collaborator" };

  await prisma.userListCollaborator.create({ data: { listId, userId } });
  await invalidate(cacheKeys.userListCollaborators(listId));
  return { success: true, message: "Collaborator added" };
}

async function mobileRemoveCollaboratorFromList(listId: string, userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "Only the list owner can remove collaborators" };
  }

  const collab = await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (!collab) return { success: false, message: "User is not a collaborator" };

  await prisma.userListCollaborator.delete({ where: { id: collab.id } });
  await invalidate(cacheKeys.userListCollaborators(listId));
  return { success: true, message: "Collaborator removed" };
}

async function mobileGetListMembers(listId: string) {
  const result = await getListMembers(listId);
  if (!result) return null;
  return JSON.parse(JSON.stringify(result));
}

async function mobileIsSubscribedToList(listId: string) {
  return isSubscribedToList(listId);
}

async function mobileToggleListSubscription(listId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const { invalidate, cacheKeys } = await import("@/lib/cache");
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Not authenticated" };

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) return { success: false, message: "List not found" };

  if (list.ownerId === session.user.id) {
    return { success: false, message: "You own this list" };
  }

  if (list.isPrivate) {
    const [isMember, isCollab] = await Promise.all([
      prisma.userListMember.findUnique({ where: { listId_userId: { listId, userId: session.user.id } } }),
      prisma.userListCollaborator.findUnique({ where: { listId_userId: { listId, userId: session.user.id } } }),
    ]);
    if (!isMember && !isCollab) {
      return { success: false, message: "This list is private" };
    }
  }

  const existing = await prisma.userListSubscription.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.userListSubscription.delete({ where: { id: existing.id } });
  } else {
    await prisma.userListSubscription.create({
      data: { listId, userId: session.user.id },
    });
  }

  await invalidate(cacheKeys.userListSubscriptions(session.user.id));
  return { success: true, message: existing ? "Unsubscribed" : "Subscribed", isSubscribed: !existing };
}

async function mobileGetLastSeenFeedAt() {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastSeenFeedAt: true },
  });

  return user?.lastSeenFeedAt?.toISOString() ?? null;
}

async function mobileUpdateLastSeenFeedAt() {
  const { prisma } = await import("@/lib/prisma");
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeenFeedAt: new Date() },
  });

  return { success: true };
}


/* eslint-disable @typescript-eslint/no-explicit-any */
const ACTIONS: Record<string, (...args: any[]) => Promise<any>> = {
  searchUsers,
  searchPosts,
  searchTagsForSearch,
  searchMarketplacePosts,
  fetchNewFeedItems,
  fetchSinglePost,
  fetchFeedPage,
  fetchCloseFriendsFeedPage,
  fetchForYouPage,
  fetchFeedSummary,
  generateFeedSummaryOnDemand,
  getLastSeenFeedAt: mobileGetLastSeenFeedAt,
  updateLastSeenFeedAt: mobileUpdateLastSeenFeedAt,
  fetchNewListFeedItems,
  fetchListFeedPage,
  getUserLists,
  getSubscribedLists,
  getCollaboratingLists: mobileGetCollaboratingLists,
  createList: mobileCreateList,
  deleteList: mobileDeleteList,
  renameList: mobileRenameList,
  toggleListPrivacy: mobileToggleListPrivacy,
  addMemberToList: mobileAddMemberToList,
  removeMemberFromList: mobileRemoveMemberFromList,
  addCollaboratorToList: mobileAddCollaboratorToList,
  removeCollaboratorFromList: mobileRemoveCollaboratorFromList,
  getListMembers: mobileGetListMembers,
  searchUsersForList,
  getListCollaborators,
  searchUsersForCollaborator,
  isSubscribedToList: mobileIsSubscribedToList,
  toggleListSubscription: mobileToggleListSubscription,
  getConversations,
  getMessages,
  getConversationDetails,
  getMessageRequests,
  startConversation,
  createGroupConversation,
  sendMessage,
  deleteMessage,
  markConversationRead,
  acceptMessageRequest,
  declineMessageRequest,
  getUnreadNotificationCount,
  getRecentNotifications,
  fetchNewcomers,
  fetchTopDiscussedPosts,
  fetchCommunitiesMediaPage,
  fetchSpotlightUsers,
  fetchAllUserLists,
  pollStatuses,
  fetchMediaFeedPage,
  recordPostView,
  fetchComments,
  toggleCommentReaction,
  createComment: mobileCreateComment,
  getBlockedUsers,
  getMutedUsers,
  toggleBlock: mobileToggleBlock,
  toggleMute: mobileToggleMute,
  updateProfile: mobileUpdateProfile,
  beginTOTPSetup,
  confirmTOTPSetup,
  disableTwoFactor,
  getPostsByTag,
  getTagInfo: mobileGetTagInfo,
  toggleTagSubscription: mobileToggleTagSubscription,
  getTagSubscriptions: mobileGetTagSubscriptions,
  getTagSubscriptionStatus,
  getCloseFriends,
  getAcceptedFriends,
  addCloseFriend: mobileAddCloseFriend,
  removeCloseFriend: mobileRemoveCloseFriend,
  getProfileLinks: mobileGetProfileLinks,
  updateProfileLinks: mobileUpdateProfileLinks,
  getUserProfileLinks: mobileGetUserProfileLinks,
  getFriendStatuses: mobileGetFriendStatuses,
  getUserStatuses: mobileGetUserStatuses,
  createStatus: mobileCreateStatus,
  toggleStatusLike: mobileToggleStatusLike,
  deleteStatus: mobileDeleteStatus,
  replyToStatus: mobileReplyToStatus,
  // Marketplace
  fetchMarketplacePost: mobileFetchMarketplacePost,
  createMarketplaceListing: mobileCreateMarketplaceListing,
  getMarketplaceQA: getQuestions,
  askMarketplaceQuestion: askQuestion,
  answerMarketplaceQuestion: answerQuestion,
  deleteMarketplaceQuestion: deleteQuestion,
  downloadFreeFile,
  redeemCouponAndDownload,
  fetchDigitalFileInfo,
  // Wall Posts
  getWallPosts: mobileGetWallPosts,
  createWallPost: mobileCreateWallPost,
  deleteWallPost: mobileDeleteWallPost,
  // Reports & Moderation
  reportContent: mobileReportContent,
  deletePost: mobileDeletePost,
  // Premium / Payments
  createMobileCheckout: mobileCreateMobileCheckout,
  createBillingPortalSession: mobileCreateBillingPortalSession,
  // Verification & Support
  sendEmailVerification: mobileSendEmailVerification,
  verifyEmail: mobileVerifyEmail,
  sendPhoneVerification: mobileSendPhoneVerification,
  verifyPhone: mobileVerifyPhone,
  submitSupportRequest: mobileSubmitSupportRequest,
  submitAppeal: mobileSubmitAppeal,
  // Profile & Theme
  getProfile: mobileGetProfile,
  getProfileCustomization: mobileGetProfileCustomization,
  getUserTheme: mobileGetUserTheme,
  saveTheme: mobileSaveTheme,
  getBackgroundPresets: mobileGetBackgroundPresets,
  updateProfileCustomization: mobileUpdateProfileCustomization,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  let body: { action?: string; args?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { action, args = [] } = body;
  if (!action || !ACTIONS[action]) {
    return corsJson(req, { error: "Unknown action" }, { status: 400 });
  }

  try {
    // If request has a bearer token, resolve the mobile session and make
    // it available to server actions via AsyncLocalStorage so that their
    // internal `auth()` calls can pick it up.
    const mobileSession = await getSessionFromRequest(req);
    const run = () => ACTIONS[action](...args);

    const result = mobileSession
      ? await withMobileSession(mobileSession, run)
      : await run();
    return corsJson(req, result ?? null);
  } catch (e) {
    console.error(`[rpc] ${action} failed:`, e);
    return corsJson(req, { error: "Internal error" }, { status: 500 });
  }
}
