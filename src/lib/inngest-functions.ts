import * as Sentry from "@sentry/nextjs";
import { inngest } from "./inngest";
import { prisma } from "./prisma";
import {
  sendCommentEmail,
  sendNewChatEmail,
  sendMentionEmail,
  sendWelcomeEmail,
  sendFriendRequestEmail,
  sendListJoinRequestEmail,
  sendNewPostEmail,
  sendTagPostEmail,
  sendTagDigestEmail,
  sendContentNoticeEmail,
  sendPostDeclinedEmail,
  sendModerationAlertEmail,
  sendSubscribedCommentEmail,
} from "./email";

function onFunctionFailure(functionId: string) {
  return async ({ error, event }: { error: Error; event: { data: unknown } }) => {
    Sentry.captureException(error, {
      extra: {
        inngestFunctionId: functionId,
        eventData: event.data,
        permanent: true,
      },
    });
  };
}

export const sendCommentEmailFn = inngest.createFunction(
  {
    id: "send-comment-email",
    retries: 3,
    onFailure: onFunctionFailure("send-comment-email"),
  },
  { event: "email/comment" },
  async ({ event }) => {
    await sendCommentEmail(event.data);
  }
);

export const sendMentionEmailFn = inngest.createFunction(
  {
    id: "send-mention-email",
    retries: 3,
    onFailure: onFunctionFailure("send-mention-email"),
  },
  { event: "email/mention" },
  async ({ event }) => {
    await sendMentionEmail(event.data);
  }
);

export const sendWelcomeEmailFn = inngest.createFunction(
  {
    id: "send-welcome-email",
    retries: 3,
    onFailure: onFunctionFailure("send-welcome-email"),
  },
  { event: "email/welcome" },
  async ({ event }) => {
    await sendWelcomeEmail(event.data.toEmail);
  }
);

export const sendFriendRequestEmailFn = inngest.createFunction(
  {
    id: "send-friend-request-email",
    retries: 3,
    onFailure: onFunctionFailure("send-friend-request-email"),
  },
  { event: "email/friend-request" },
  async ({ event }) => {
    await sendFriendRequestEmail(event.data);
  }
);

export const sendListJoinRequestEmailFn = inngest.createFunction(
  {
    id: "send-list-join-request-email",
    retries: 3,
    onFailure: onFunctionFailure("send-list-join-request-email"),
  },
  { event: "email/list-join-request" },
  async ({ event }) => {
    await sendListJoinRequestEmail(event.data);
  }
);

export const sendNewPostEmailFn = inngest.createFunction(
  {
    id: "send-new-post-email",
    retries: 3,
    onFailure: onFunctionFailure("send-new-post-email"),
  },
  { event: "email/new-post" },
  async ({ event }) => {
    await sendNewPostEmail(event.data);
  }
);

export const deleteUserMediaFn = inngest.createFunction(
  {
    id: "delete-user-media",
    retries: 3,
    onFailure: onFunctionFailure("delete-user-media"),
  },
  { event: "user/delete-media" },
  async ({ event }) => {
    const { blobUrls } = event.data as { blobUrls: string[] };
    if (blobUrls.length > 0) {
      const { del } = await import("@vercel/blob");
      await del(blobUrls);
    }
  }
);

export async function pollChatEmailNotifications(): Promise<{ emailsSent: number }> {
  // Find all 1:1 conversation participants who have emailOnNewChat enabled
  const participants = await prisma.conversationParticipant.findMany({
    where: {
      conversation: { isGroup: false },
      user: {
        emailOnNewChat: true,
        email: { not: null },
      },
    },
    select: {
      id: true,
      userId: true,
      conversationId: true,
      lastReadAt: true,
      chatEmailSentAt: true,
      user: {
        select: { email: true },
      },
    },
  });

  let emailsSent = 0;

  for (const participant of participants) {
    // Skip if we already emailed for this unread batch.
    // chatEmailSentAt > lastReadAt means they haven't read since we last emailed.
    if (
      participant.chatEmailSentAt &&
      (!participant.lastReadAt ||
        participant.chatEmailSentAt > participant.lastReadAt)
    ) {
      continue;
    }

    // Count unread messages from other users
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: participant.conversationId,
        senderId: { not: participant.userId },
        ...(participant.lastReadAt
          ? { createdAt: { gt: participant.lastReadAt } }
          : {}),
      },
    });

    if (unreadCount === 0) continue;

    // Find who sent the most recent unread message for the email
    const latestUnread = await prisma.message.findFirst({
      where: {
        conversationId: participant.conversationId,
        senderId: { not: participant.userId },
        ...(participant.lastReadAt
          ? { createdAt: { gt: participant.lastReadAt } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { displayName: true, username: true, name: true },
        },
      },
    });

    if (!latestUnread) continue;

    const senderName =
      latestUnread.sender.displayName ??
      latestUnread.sender.username ??
      latestUnread.sender.name ??
      "Someone";

    try {
      await sendNewChatEmail({
        toEmail: participant.user.email!,
        senderName,
        conversationId: participant.conversationId,
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          inngestFunctionId: "poll-chat-email-notifications",
          toEmail: participant.user.email,
          conversationId: participant.conversationId,
        },
      });
      continue;
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { chatEmailSentAt: new Date() },
    });

    emailsSent++;
  }

  return { emailsSent };
}

export const sendTagPostEmailFn = inngest.createFunction(
  {
    id: "send-tag-post-email",
    retries: 3,
    onFailure: onFunctionFailure("send-tag-post-email"),
  },
  { event: "email/tag-post" },
  async ({ event }) => {
    await sendTagPostEmail(event.data as Parameters<typeof sendTagPostEmail>[0]);
  }
);

export async function sendTagDigestEmails(): Promise<{ emailsSent: number }> {
  // Find all users with digest tag subscriptions who have email enabled
  const subscriptions = await prisma.tagSubscription.findMany({
    where: {
      frequency: "digest",
      emailNotification: true,
      user: {
        emailOnTagPost: true,
        email: { not: null },
      },
    },
    select: {
      id: true,
      userId: true,
      tagId: true,
      lastDigestSentAt: true,
      tag: { select: { id: true, name: true } },
      user: { select: { email: true, showNsfwContent: true } },
    },
  });

  if (subscriptions.length === 0) return { emailsSent: 0 };

  // Group subscriptions by user
  const userSubs = new Map<
    string,
    {
      email: string;
      showNsfwContent: boolean;
      tags: Array<{ id: string; subId: string; name: string; since: Date }>;
    }
  >();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const sub of subscriptions) {
    if (!userSubs.has(sub.userId)) {
      userSubs.set(sub.userId, {
        email: sub.user.email!,
        showNsfwContent: sub.user.showNsfwContent,
        tags: [],
      });
    }
    userSubs.get(sub.userId)!.tags.push({
      id: sub.tagId,
      subId: sub.id,
      name: sub.tag.name,
      since: sub.lastDigestSentAt ?? oneDayAgo,
    });
  }

  let emailsSent = 0;

  for (const [userId, userData] of userSubs) {
    const tagIds = userData.tags.map((t) => t.id);
    const earliestSince = userData.tags.reduce(
      (min, t) => (t.since < min ? t.since : min),
      userData.tags[0].since
    );

    // Find posts from subscribed tags since last digest
    const postTags = await prisma.postTag.findMany({
      where: {
        tagId: { in: tagIds },
        post: {
          createdAt: { gt: earliestSince },
          isSensitive: false,
          isGraphicNudity: false,
          isCloseFriendsOnly: false,
          authorId: { not: userId },
          ...(userData.showNsfwContent ? {} : { isNsfw: false }),
        },
      },
      select: {
        post: {
          select: {
            id: true,
            author: {
              select: { displayName: true, username: true, name: true },
            },
          },
        },
        tag: { select: { name: true } },
      },
      orderBy: { post: { createdAt: "desc" } },
    });

    if (postTags.length === 0) continue;

    // Group by post and collect tag names
    const postMap = new Map<
      string,
      { authorName: string; tagNames: Set<string> }
    >();
    for (const pt of postTags) {
      if (!pt.post) continue;
      if (!postMap.has(pt.post.id)) {
        const authorName =
          pt.post.author?.displayName ??
          pt.post.author?.username ??
          pt.post.author?.name ??
          "Someone";
        postMap.set(pt.post.id, { authorName, tagNames: new Set() });
      }
      postMap.get(pt.post.id)!.tagNames.add(pt.tag.name);
    }

    const posts = Array.from(postMap.entries()).map(
      ([postId, { authorName, tagNames }]) => ({
        postId,
        authorName,
        tagNames: Array.from(tagNames),
      })
    );

    try {
      await sendTagDigestEmail({ toEmail: userData.email, posts });
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          inngestFunctionId: "send-tag-digest-emails",
          toEmail: userData.email,
        },
      });
      continue;
    }

    // Update lastDigestSentAt for all this user's digest subscriptions
    await prisma.tagSubscription.updateMany({
      where: { id: { in: userData.tags.map((t) => t.subId) } },
      data: { lastDigestSentAt: now },
    });

    emailsSent++;
  }

  return { emailsSent };
}

export const sendTagDigestFn = inngest.createFunction(
  { id: "send-tag-digest-emails" },
  { cron: "0 8 * * *" },
  async () => sendTagDigestEmails()
);

export const pollChatEmailNotificationsFn = inngest.createFunction(
  { id: "poll-chat-email-notifications" },
  { cron: "0 * * * *" },
  async () => pollChatEmailNotifications()
);

// Content moderation scanning

const MODERATION_API_URL = process.env.MODERATION_API_URL;
const MODERATION_API_KEY = process.env.MODERATION_API_KEY;

function extractPlainText(lexicalJson: string): string {
  try {
    const parsed = JSON.parse(lexicalJson);
    const texts: string[] = [];
    function walk(node: { text?: string; children?: unknown[] }) {
      if (node.text) texts.push(node.text);
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child as { text?: string; children?: unknown[] });
        }
      }
    }
    walk(parsed.root ?? parsed);
    return texts.join(" ");
  } catch {
    return lexicalJson;
  }
}

function extractImageUrls(lexicalJson: string): string[] {
  const urls: string[] = [];
  try {
    const parsed = JSON.parse(lexicalJson);
    function walk(node: { type?: string; src?: string; children?: unknown[] }) {
      if (node.type === "image" && node.src) {
        urls.push(node.src);
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child as { type?: string; src?: string; children?: unknown[] });
        }
      }
    }
    walk(parsed.root ?? parsed);
  } catch {
    // Not parseable, no images to extract
  }
  return urls;
}

export const scanPostContentFn = inngest.createFunction(
  {
    id: "scan-post-content",
    retries: 3,
    onFailure: onFunctionFailure("scan-post-content"),
  },
  { event: "moderation/scan-post" },
  async ({ event }) => {
    const { postId, userId } = event.data as { postId: string; userId: string };

    if (!MODERATION_API_URL || !MODERATION_API_KEY) {
      console.warn("Moderation service not configured, skipping scan");
      return { skipped: true };
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        isNsfw: true,
        isGraphicNudity: true,
        isSensitive: true,
        authorId: true,
      },
    });

    if (!post || !post.authorId) return { skipped: true, reason: "post not found" };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, contentWarnings: true, ageVerified: true },
    });

    if (!user) return { skipped: true, reason: "user not found" };

    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": MODERATION_API_KEY,
    };

    // Scan images for NSFW content
    const imageUrls = extractImageUrls(post.content);
    let nsfwDetected = false;
    let nsfwScore = 0;

    for (const url of imageUrls) {
      try {
        const resp = await fetch(`${MODERATION_API_URL}/scan/image`, {
          method: "POST",
          headers,
          body: JSON.stringify({ url }),
        });
        if (resp.ok) {
          const result = await resp.json() as { nsfw: boolean; score: number };
          if (result.nsfw) {
            nsfwDetected = true;
            nsfwScore = Math.max(nsfwScore, result.score);
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: "moderation-image-scan", postId, url },
        });
      }
    }

    // Scan text for hate speech / bullying
    const plainText = extractPlainText(post.content);
    let hateSpeechDetected = false;
    let bullyingDetected = false;
    let textConfidence = 0;
    let textViolationType = "";

    if (plainText.trim().length > 0) {
      try {
        const resp = await fetch(`${MODERATION_API_URL}/scan/text`, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: plainText }),
        });
        if (resp.ok) {
          const result = await resp.json() as {
            toxicity: number;
            identity_attack: number;
            insult: number;
            is_hate_speech: boolean;
            is_bullying: boolean;
          };
          hateSpeechDetected = result.is_hate_speech;
          bullyingDetected = result.is_bullying;
          if (hateSpeechDetected) {
            textConfidence = result.identity_attack;
            textViolationType = "hate_speech";
          } else if (bullyingDetected) {
            textConfidence = result.insult;
            textViolationType = "bullying";
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: "moderation-text-scan", postId },
        });
      }
    }

    // Handle NSFW detection: auto-mark post and warn user
    if (nsfwDetected && !post.isNsfw && !post.isGraphicNudity) {
      // Auto-mark based on confidence: high score = graphic/explicit, lower = nsfw/nudity
      const isGraphic = nsfwScore >= 0.85;

      // Non-age-verified users cannot have graphic/explicit posts — decline it
      if (isGraphic && !user.ageVerified) {
        await prisma.post.delete({ where: { id: postId } });

        await prisma.notification.create({
          data: {
            type: "CONTENT_MODERATION",
            actorId: user.id,
            targetUserId: user.id,
          },
        });

        if (user.email) {
          await sendPostDeclinedEmail({
            toEmail: user.email,
          });
        }

        return { postId, nsfwDetected, postDeclined: true };
      }

      await prisma.post.update({
        where: { id: postId },
        data: isGraphic ? { isGraphicNudity: true } : { isNsfw: true },
      });

      const markingLabel = isGraphic ? "graphic/explicit" : "nsfw (nudity)";

      // Create violation record
      await prisma.contentViolation.create({
        data: {
          userId: user.id,
          postId,
          type: "nsfw_unmarked",
          confidence: nsfwScore,
          action: "auto_marked",
        },
      });

      // Create in-app notification
      await prisma.notification.create({
        data: {
          type: "CONTENT_MODERATION",
          actorId: user.id,
          targetUserId: user.id,
          postId,
        },
      });

      // Send a friendly notice each time
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { contentWarnings: { increment: 1 } },
        select: { contentWarnings: true },
      });

      if (user.email) {
        await sendContentNoticeEmail({
          toEmail: user.email,
          postId,
          markingLabel,
          warningCount: updatedUser.contentWarnings,
        });
      }
    }

    // Handle under-labeled posts: graphic/explicit content marked only as NSFW
    if (nsfwDetected && nsfwScore >= 0.85 && post.isNsfw && !post.isGraphicNudity) {
      // Non-age-verified users cannot have graphic/explicit posts — decline it
      if (!user.ageVerified) {
        await prisma.post.delete({ where: { id: postId } });

        await prisma.notification.create({
          data: {
            type: "CONTENT_MODERATION",
            actorId: user.id,
            targetUserId: user.id,
          },
        });

        if (user.email) {
          await sendPostDeclinedEmail({ toEmail: user.email });
        }

        return { postId, nsfwDetected, postDeclined: true };
      }

      // Upgrade from NSFW to graphic/explicit
      await prisma.post.update({
        where: { id: postId },
        data: { isGraphicNudity: true },
      });

      await prisma.notification.create({
        data: {
          type: "CONTENT_MODERATION",
          actorId: user.id,
          targetUserId: user.id,
          postId,
        },
      });

      if (user.email) {
        await sendContentNoticeEmail({
          toEmail: user.email,
          postId,
          markingLabel: "graphic/explicit",
          warningCount: 0,
        });
      }
    }

    // Handle hate speech / bullying: notify admin for human review
    if (hateSpeechDetected || bullyingDetected) {
      await prisma.contentViolation.create({
        data: {
          userId: user.id,
          postId,
          type: textViolationType,
          confidence: textConfidence,
          action: "pending_review",
        },
      });

      await sendModerationAlertEmail({
        postId,
        authorUsername: user.username ?? "unknown",
        violationType: textViolationType,
        confidence: textConfidence,
        contentPreview: plainText.slice(0, 200),
      });
    }

    return {
      postId,
      nsfwDetected,
      hateSpeechDetected,
      bullyingDetected,
    };
  }
);

// Chat message moderation scanning

const CHAT_ABUSE_THRESHOLD = 3;

export const scanChatMessageFn = inngest.createFunction(
  {
    id: "scan-chat-message",
    retries: 3,
    onFailure: onFunctionFailure("scan-chat-message"),
  },
  { event: "moderation/scan-chat-message" },
  async ({ event }) => {
    const { messageId, senderId, conversationId } = event.data as {
      messageId: string;
      senderId: string;
      conversationId: string;
    };

    if (!MODERATION_API_URL || !MODERATION_API_KEY) {
      console.warn("Moderation service not configured, skipping chat scan");
      return { skipped: true };
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, content: true, mediaUrl: true, mediaType: true, deletedAt: true },
    });

    if (!message || message.deletedAt) {
      return { skipped: true, reason: "message not found or deleted" };
    }

    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": MODERATION_API_KEY,
    };

    // Scan media for NSFW content (images and video thumbnails)
    let nsfwDetected = false;
    let nsfwScore = 0;

    if (message.mediaUrl && (message.mediaType === "image" || message.mediaType === "video")) {
      try {
        const resp = await fetch(`${MODERATION_API_URL}/scan/image`, {
          method: "POST",
          headers,
          body: JSON.stringify({ url: message.mediaUrl }),
        });
        if (resp.ok) {
          const result = await resp.json() as { nsfw: boolean; score: number };
          if (result.nsfw) {
            nsfwDetected = true;
            nsfwScore = result.score;
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: "chat-moderation-image-scan", messageId },
        });
      }
    }

    // If NSFW detected, mark the message
    if (nsfwDetected) {
      await prisma.message.update({
        where: { id: messageId },
        data: { isNsfw: true, nsfwScore },
      });

      // Publish update to Ably so recipients see the overlay in real-time
      try {
        const { getAblyRestClient } = await import("./ably");
        const ably = getAblyRestClient();
        const channel = ably.channels.get(`chat:${conversationId}`);
        await channel.publish("nsfw-update", { id: messageId, isNsfw: true });
      } catch {
        // Non-critical
      }
    }

    // Scan text for hate speech / bullying
    let hateSpeechDetected = false;
    let bullyingDetected = false;
    let textConfidence = 0;
    let textViolationType = "";

    const plainText = message.content.trim();
    if (plainText.length > 0) {
      try {
        const resp = await fetch(`${MODERATION_API_URL}/scan/text`, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: plainText }),
        });
        if (resp.ok) {
          const result = await resp.json() as {
            toxicity: number;
            identity_attack: number;
            insult: number;
            is_hate_speech: boolean;
            is_bullying: boolean;
          };
          hateSpeechDetected = result.is_hate_speech;
          bullyingDetected = result.is_bullying;
          if (hateSpeechDetected) {
            textConfidence = result.identity_attack;
            textViolationType = "hate_speech";
          } else if (bullyingDetected) {
            textConfidence = result.insult;
            textViolationType = "bullying";
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: "chat-moderation-text-scan", messageId },
        });
      }
    }

    // If abuse detected, create flag and check threshold for each recipient
    if (hateSpeechDetected || bullyingDetected) {
      // Get all other participants in the conversation (recipients)
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      });

      for (const participant of participants) {
        const recipientId = participant.userId;

        // Record the abuse flag
        await prisma.chatAbuseFlag.create({
          data: {
            senderId,
            recipientId,
            messageId,
            confidence: textConfidence,
            violationType: textViolationType,
          },
        });

        // Count total high-confidence flags for this sender→recipient pair
        const flagCount = await prisma.chatAbuseFlag.count({
          where: { senderId, recipientId },
        });

        // Only notify after reaching the threshold
        if (flagCount >= CHAT_ABUSE_THRESHOLD) {
          // Check if recipient has dismissed alerts from this sender
          const dismissed = await prisma.chatAbuseDismissal.findUnique({
            where: { userId_dismissedSenderId: { userId: recipientId, dismissedSenderId: senderId } },
          });

          if (!dismissed) {
            // Only create a new notification if there isn't already an unread one
            const existingNotification = await prisma.notification.findFirst({
              where: {
                type: "CHAT_ABUSE",
                actorId: senderId,
                targetUserId: recipientId,
                readAt: null,
              },
            });

            if (!existingNotification) {
              const { createNotification } = await import("./notifications");
              await createNotification({
                type: "CHAT_ABUSE",
                actorId: senderId,
                targetUserId: recipientId,
                messageId,
              });
            }
          }
        }
      }

      // Also alert admin for review
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { username: true },
      });
      await sendModerationAlertEmail({
        postId: messageId,
        authorUsername: sender?.username ?? "unknown",
        violationType: textViolationType,
        confidence: textConfidence,
        contentPreview: `[Chat message] ${plainText.slice(0, 200)}`,
      });
    }

    return { messageId, nsfwDetected, hateSpeechDetected, bullyingDetected };
  }
);

// Chatroom message moderation scanning

export const scanChatRoomMessageFn = inngest.createFunction(
  {
    id: "scan-chatroom-message",
    retries: 3,
    onFailure: onFunctionFailure("scan-chatroom-message"),
  },
  { event: "moderation/scan-chatroom-message" },
  async ({ event }) => {
    const { messageId, senderId, roomSlug } = event.data as {
      messageId: string;
      senderId: string;
      roomSlug: string;
    };

    if (!MODERATION_API_URL || !MODERATION_API_KEY) {
      console.warn("Moderation service not configured, skipping chatroom scan");
      return { skipped: true };
    }

    const message = await prisma.chatRoomMessage.findUnique({
      where: { id: messageId },
      select: { id: true, content: true, mediaUrl: true, mediaType: true, deletedAt: true, isNsfw: true },
    });

    if (!message || message.deletedAt) {
      return { skipped: true, reason: "message not found or deleted" };
    }

    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": MODERATION_API_KEY,
    };

    // Scan media for NSFW content
    let nsfwDetected = false;

    if (message.mediaUrl && (message.mediaType === "image" || message.mediaType === "video")) {
      try {
        const resp = await fetch(`${MODERATION_API_URL}/scan/image`, {
          method: "POST",
          headers,
          body: JSON.stringify({ url: message.mediaUrl }),
        });
        if (resp.ok) {
          const result = await resp.json() as { nsfw: boolean; score: number };
          if (result.nsfw) {
            nsfwDetected = true;
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: "chatroom-moderation-image-scan", messageId },
        });
      }
    }

    // Auto-mark as NSFW if detected and not already marked
    if (nsfwDetected && !message.isNsfw) {
      await prisma.chatRoomMessage.update({
        where: { id: messageId },
        data: { isNsfw: true },
      });

      // Publish real-time update so clients show the overlay
      try {
        const { getAblyRestClient } = await import("./ably");
        const ably = getAblyRestClient();
        const channel = ably.channels.get(`chatroom:${roomSlug}`);
        await channel.publish("nsfw-update", JSON.stringify({ id: messageId, isNsfw: true }));
      } catch {
        // Non-critical
      }

      // Log for admin awareness (ContentViolation requires postId, so skip for chatroom messages)
    }

    return { messageId, nsfwDetected };
  }
);

// Publish scheduled posts that are due

export async function publishScheduledPosts(): Promise<{ published: number }> {
  const now = new Date();
  const posts = await prisma.post.findMany({
    where: {
      scheduledFor: { not: null, lte: now },
      author: { suspended: false },
    },
    select: {
      id: true,
      content: true,
      authorId: true,
      scheduledFor: true,
      isSensitive: true,
      isNsfw: true,
      isGraphicNudity: true,
      isCloseFriendsOnly: true,
      hasCustomAudience: true,
      tags: { include: { tag: { select: { id: true, name: true } } } },
      audience: { select: { userId: true } },
    },
  });

  if (posts.length === 0) return { published: 0 };

  // Import side-effect helpers once, outside the loop
  const { extractMentionsFromLexicalJson, createMentionNotifications } = await import("./mentions");
  const { notifyPostSubscribers } = await import("./subscription-notifications");
  const { notifyTagSubscribers } = await import("./tag-subscription-notifications");
  const { awardReferralFirstPostBonus, checkStarsMilestone } = await import("./referral");
  const { invalidatePattern, invalidate, cacheKeys } = await import("./cache");

  let published = 0;

  for (const post of posts) {
    if (!post.authorId) continue;

    // Mark as published: clear scheduledFor and set createdAt to scheduled time
    await prisma.post.update({
      where: { id: post.id },
      data: { scheduledFor: null, createdAt: post.scheduledFor! },
    });

    await awardReferralFirstPostBonus(post.authorId);
    await checkStarsMilestone(post.authorId);

    // Mention notifications
    const mentionedUsernames = extractMentionsFromLexicalJson(post.content);
    if (mentionedUsernames.length > 0) {
      await createMentionNotifications({
        usernames: mentionedUsernames,
        actorId: post.authorId,
        postId: post.id,
      });
    }

    // Post subscriber notifications
    await notifyPostSubscribers({
      authorId: post.authorId,
      postId: post.id,
      isSensitive: post.isSensitive,
      isNsfw: post.isNsfw,
      isGraphicNudity: post.isGraphicNudity,
      isCloseFriendsOnly: post.isCloseFriendsOnly,
      hasCustomAudience: post.hasCustomAudience,
      customAudienceIds: post.audience.map((a) => a.userId),
    });

    // Tag subscriber notifications
    if (post.tags.length > 0) {
      await notifyTagSubscribers({
        authorId: post.authorId,
        postId: post.id,
        tagIds: post.tags.map((t) => t.tag.id),
        tagNames: post.tags.map((t) => t.tag.name),
        isSensitive: post.isSensitive,
        isNsfw: post.isNsfw,
        isGraphicNudity: post.isGraphicNudity,
        isCloseFriendsOnly: post.isCloseFriendsOnly,
        hasCustomAudience: post.hasCustomAudience,
      });
    }

    // Trigger moderation scan
    await inngest.send({
      name: "moderation/scan-post",
      data: { postId: post.id, userId: post.authorId },
    });

    // Cache invalidation
    await invalidatePattern("user:*:feed-summary");
    await invalidate(cacheKeys.profileTabFlags(post.authorId));

    published++;
  }

  return { published };
}

export const publishScheduledPostsFn = inngest.createFunction(
  { id: "publish-scheduled-posts" },
  { cron: "*/5 * * * *" },
  async () => publishScheduledPosts()
);

export const sendSubscribedCommentEmailFn = inngest.createFunction(
  {
    id: "send-subscribed-comment-email",
    retries: 3,
    onFailure: onFunctionFailure("send-subscribed-comment-email"),
  },
  { event: "email/subscribed-comment" },
  async ({ event }) => {
    await sendSubscribedCommentEmail(event.data);
  }
);

export const allFunctions = [
  sendCommentEmailFn,
  sendMentionEmailFn,
  sendWelcomeEmailFn,
  sendFriendRequestEmailFn,
  sendNewPostEmailFn,
  sendTagPostEmailFn,
  deleteUserMediaFn,
  pollChatEmailNotificationsFn,
  sendTagDigestFn,
  scanPostContentFn,
  scanChatMessageFn,
  scanChatRoomMessageFn,
  publishScheduledPostsFn,
  sendSubscribedCommentEmailFn,
];
