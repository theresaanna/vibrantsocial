import * as Sentry from "@sentry/nextjs";
import { inngest } from "./inngest";
import { prisma } from "./prisma";
import {
  sendCommentEmail,
  sendNewChatEmail,
  sendMentionEmail,
  sendWelcomeEmail,
  sendFriendRequestEmail,
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

export const pollChatEmailNotificationsFn = inngest.createFunction(
  { id: "poll-chat-email-notifications" },
  { cron: "*/15 * * * *" },
  async () => pollChatEmailNotifications()
);

export const allFunctions = [
  sendCommentEmailFn,
  sendMentionEmailFn,
  sendWelcomeEmailFn,
  sendFriendRequestEmailFn,
  deleteUserMediaFn,
  pollChatEmailNotificationsFn,
];
