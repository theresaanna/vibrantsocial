"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";
import {
  requireAuthWithRateLimit,
  isActionError,
  USER_PROFILE_SELECT,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

const MAX_CONTENT_LENGTH = 2000;
const PAGE_SIZE = 50;

export interface ChatRoomMessageData {
  id: string;
  room: string;
  senderId: string;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
    profileFrameId: string | null;
    usernameFont: string | null;
  };
}

// ---------------------------------------------------------------------------
// Send message
// ---------------------------------------------------------------------------

export async function sendChatRoomMessage(
  content: string,
  room: string = "lobby"
): Promise<ActionState & { messageId?: string }> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const trimmed = content.trim();
  if (!trimmed) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, message: `Message too long (max ${MAX_CONTENT_LENGTH} characters)` };
  }

  const message = await prisma.chatRoomMessage.create({
    data: {
      room,
      senderId: session.user.id,
      content: trimmed,
    },
    include: {
      sender: { select: USER_PROFILE_SELECT },
    },
  });

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${room}`);
    await channel.publish("new", {
      id: message.id,
      room: message.room,
      senderId: message.senderId,
      content: message.content,
      sender: JSON.stringify(message.sender),
      editedAt: null,
      deletedAt: null,
      createdAt: message.createdAt.toISOString(),
    });
  } catch {
    // Non-critical — DB write succeeded
  }

  return { success: true, message: "Message sent", messageId: message.id };
}

// ---------------------------------------------------------------------------
// Edit message
// ---------------------------------------------------------------------------

export async function editChatRoomMessage(
  messageId: string,
  content: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const trimmed = content.trim();
  if (!trimmed) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, message: `Message too long (max ${MAX_CONTENT_LENGTH} characters)` };
  }

  const existing = await prisma.chatRoomMessage.findUnique({
    where: { id: messageId },
  });
  if (!existing || existing.senderId !== session.user.id) {
    return { success: false, message: "Message not found or not yours" };
  }
  if (existing.deletedAt) {
    return { success: false, message: "Cannot edit a deleted message" };
  }

  const updated = await prisma.chatRoomMessage.update({
    where: { id: messageId },
    data: { content: trimmed, editedAt: new Date() },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${existing.room}`);
    await channel.publish("edit", {
      id: messageId,
      content: trimmed,
      editedAt: updated.editedAt!.toISOString(),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message edited" };
}

// ---------------------------------------------------------------------------
// Delete message
// ---------------------------------------------------------------------------

export async function deleteChatRoomMessage(
  messageId: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const existing = await prisma.chatRoomMessage.findUnique({
    where: { id: messageId },
  });
  if (!existing || existing.senderId !== session.user.id) {
    return { success: false, message: "Message not found or not yours" };
  }

  const now = new Date();
  await prisma.chatRoomMessage.update({
    where: { id: messageId },
    data: { deletedAt: now },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${existing.room}`);
    await channel.publish("delete", {
      id: messageId,
      deletedAt: now.toISOString(),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message deleted" };
}

// ---------------------------------------------------------------------------
// Fetch messages
// ---------------------------------------------------------------------------

export async function getChatRoomMessages(
  room: string = "lobby",
  cursor?: string
): Promise<{ messages: ChatRoomMessageData[]; nextCursor: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { messages: [], nextCursor: null };

  const messages = await prisma.chatRoomMessage.findMany({
    where: {
      room,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: USER_PROFILE_SELECT },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });

  const hasMore = messages.length > PAGE_SIZE;
  const page = hasMore ? messages.slice(0, PAGE_SIZE) : messages;

  // Return in chronological order (oldest first)
  const chronological = page.reverse();

  return {
    messages: JSON.parse(JSON.stringify(chronological)),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
}
