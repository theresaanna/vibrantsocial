import { inngest } from "./inngest";
import {
  sendCommentEmail,
  sendNewChatEmail,
  sendMentionEmail,
  sendWelcomeEmail,
  sendFriendRequestEmail,
} from "./email";

export const sendCommentEmailFn = inngest.createFunction(
  { id: "send-comment-email", retries: 3 },
  { event: "email/comment" },
  async ({ event }) => {
    await sendCommentEmail(event.data);
  }
);

export const sendChatEmailFn = inngest.createFunction(
  { id: "send-chat-email", retries: 3 },
  { event: "email/chat" },
  async ({ event }) => {
    await sendChatEmail(event.data);
  }
);

async function sendChatEmail(data: {
  toEmail: string;
  senderName: string;
  conversationId: string;
}) {
  await sendNewChatEmail(data);
}

export const sendMentionEmailFn = inngest.createFunction(
  { id: "send-mention-email", retries: 3 },
  { event: "email/mention" },
  async ({ event }) => {
    await sendMentionEmail(event.data);
  }
);

export const sendWelcomeEmailFn = inngest.createFunction(
  { id: "send-welcome-email", retries: 3 },
  { event: "email/welcome" },
  async ({ event }) => {
    await sendWelcomeEmail(event.data.toEmail);
  }
);

export const sendFriendRequestEmailFn = inngest.createFunction(
  { id: "send-friend-request-email", retries: 3 },
  { event: "email/friend-request" },
  async ({ event }) => {
    await sendFriendRequestEmail(event.data);
  }
);

export const deleteUserMediaFn = inngest.createFunction(
  { id: "delete-user-media", retries: 3 },
  { event: "user/delete-media" },
  async ({ event }) => {
    const { blobUrls } = event.data as { blobUrls: string[] };
    if (blobUrls.length > 0) {
      const { del } = await import("@vercel/blob");
      await del(blobUrls);
    }
  }
);

export const allFunctions = [
  sendCommentEmailFn,
  sendChatEmailFn,
  sendMentionEmailFn,
  sendWelcomeEmailFn,
  sendFriendRequestEmailFn,
  deleteUserMediaFn,
];
