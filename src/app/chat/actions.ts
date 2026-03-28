"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { getAblyRestClient } from "@/lib/ably";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import {
  requireAuthWithRateLimit,
  isActionError,
  hasBlock,
  groupReactions,
  createNotificationSafe,
  USER_PROFILE_SELECT,
  areFriends,
} from "@/lib/action-utils";
import type {
  ActionState,
  ConversationListItem,
  MessageData,
  MessageReplyTo,
  MessageRequestData,
  ChatUserProfile,
  ReactionGroup,
  MediaType,
} from "@/types/chat";

const replyToInclude = {
  select: {
    id: true,
    content: true,
    senderId: true,
    deletedAt: true,
    mediaType: true,
    sender: {
      select: { displayName: true, username: true, name: true },
    },
  },
} as const;

function formatReplyTo(
  replyTo: {
    id: string;
    content: string;
    senderId: string;
    deletedAt: Date | null;
    mediaType: string | null;
    sender: { displayName: string | null; username: string | null; name: string | null };
  } | null
): MessageReplyTo | null {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    content: replyTo.content,
    senderId: replyTo.senderId,
    senderName:
      replyTo.sender.displayName ?? replyTo.sender.username ?? replyTo.sender.name ?? "User",
    mediaType: (replyTo.mediaType ?? null) as MediaType | null,
    deletedAt: replyTo.deletedAt,
  };
}


interface ConversationParticipantRecord {
  lastReadAt: Date | null;
  conversation: {
    id: string;
    isGroup: boolean;
    name: string | null;
    avatarUrl: string | null;
    participants: Array<{ userId: string; user: ChatUserProfile }>;
    messages: Array<{
      content: string;
      senderId: string;
      createdAt: Date;
      mediaType: string | null;
    }>;
  };
}

export async function getConversations(): Promise<ConversationListItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  const participantRecords = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: USER_PROFILE_SELECT } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  return (participantRecords as ConversationParticipantRecord[]).map((pr) => {
    const conv = pr.conversation;
    const otherParticipants = conv.participants
      .filter((p) => p.userId !== userId)
      .map((p) => p.user);

    const lastMessage = conv.messages[0] ?? null;
    const unreadCount = lastMessage
      ? pr.lastReadAt
        ? lastMessage.createdAt > pr.lastReadAt
          ? 1
          : 0
        : 1
      : 0;

    return {
      id: conv.id,
      isGroup: conv.isGroup,
      name: conv.name,
      avatarUrl: conv.avatarUrl,
      participants: otherParticipants,
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
            mediaType: (lastMessage.mediaType as import("@/types/chat").MediaType) ?? null,
          }
        : null,
      unreadCount,
    };
  });
}

export async function getMessages(
  conversationId: string,
  cursor?: string
): Promise<{ messages: MessageData[]; nextCursor: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { messages: [], nextCursor: null };

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) return { messages: [], nextCursor: null };

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: USER_PROFILE_SELECT },
      reactions: { select: { emoji: true, userId: true } },
      replyTo: replyToInclude,
    },
  });

  const hasMore = messages.length > 50;
  const trimmed = hasMore ? messages.slice(0, 50) : messages;

  return {
    messages: trimmed.reverse().map((m) => ({
      ...m,
      mediaType: (m.mediaType ?? null) as MediaType | null,
      reactions: groupReactions(m.reactions),
      replyTo: formatReplyTo(m.replyTo),
    })) as MessageData[],
    nextCursor: hasMore ? trimmed[0].id : null,
  };
}

export async function getMessageRequests(): Promise<MessageRequestData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.messageRequest.findMany({
    where: { receiverId: session.user.id, status: "PENDING" },
    include: { sender: { select: USER_PROFILE_SELECT } },
    orderBy: { createdAt: "desc" },
  });
}

export async function startConversation(
  targetUserId: string
): Promise<ActionState & { conversationId?: string }> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const isNotSuspended = await requireNotSuspended(session.user.id);
  if (!isNotSuspended) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to start conversations" };
  }

  const userId = session.user.id;

  if (userId === targetUserId) {
    return { success: false, message: "Cannot message yourself" };
  }

  // Check for block between the two users
  if (await hasBlock(userId, targetUserId)) {
    return { success: false, message: "Cannot start conversation with this user" };
  }

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  // Check for existing 1:1 conversation
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  });

  if (existingConversation) {
    return { success: true, message: "Conversation found", conversationId: existingConversation.id };
  }

  // Check friendship
  const friendsResult = await areFriends(userId, targetUserId);

  if (friendsResult) {
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
    });
    revalidatePath("/chat");
    return { success: true, message: "Conversation created", conversationId: conversation.id };
  }

  // Not friends — create message request
  await prisma.messageRequest.upsert({
    where: {
      senderId_receiverId: { senderId: userId, receiverId: targetUserId },
    },
    update: {},
    create: { senderId: userId, receiverId: targetUserId },
  });

  return { success: true, message: "Message request sent" };
}

export type ChatRequestStatus = "none" | "pending" | "accepted" | "declined" | "friends" | "has_conversation";

export async function getChatRequestStatus(targetUserId: string): Promise<ChatRequestStatus> {
  const session = await auth();
  if (!session?.user?.id) return "none";

  const userId = session.user.id;

  // Check if already friends
  if (await areFriends(userId, targetUserId)) return "friends";

  // Check for existing 1:1 conversation
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  });
  if (existingConversation) return "has_conversation";

  // Check for existing message request (sent by current user)
  const request = await prisma.messageRequest.findUnique({
    where: {
      senderId_receiverId: { senderId: userId, receiverId: targetUserId },
    },
    select: { status: true },
  });

  if (!request) return "none";
  if (request.status === "PENDING") return "pending";
  if (request.status === "ACCEPTED") return "accepted";
  return "declined";
}

export async function sendChatRequest(targetUserId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const userId = session.user.id;

  // Aggressive rate limit: 5 per hour
  const { chatRequestLimiter } = await import("@/lib/rate-limit");
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (await isRateLimited(chatRequestLimiter, `chat-req:${userId}`)) {
    return { success: false, message: "Too many chat requests. Please try again later." };
  }

  if (userId === targetUserId) {
    return { success: false, message: "Cannot send a chat request to yourself" };
  }

  if (await hasBlock(userId, targetUserId)) {
    return { success: false, message: "Cannot send a chat request to this user" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!targetUser) {
    return { success: false, message: "User not found" };
  }

  // Check for existing conversation
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
  });
  if (existingConversation) {
    return { success: false, message: "You already have a conversation with this user" };
  }

  // Check if already friends — they should use the message button instead
  if (await areFriends(userId, targetUserId)) {
    return { success: false, message: "You are friends — use the message button instead" };
  }

  // Upsert the message request (resets declined requests)
  await prisma.messageRequest.upsert({
    where: {
      senderId_receiverId: { senderId: userId, receiverId: targetUserId },
    },
    update: { status: "PENDING" },
    create: { senderId: userId, receiverId: targetUserId },
  });

  return { success: true, message: "Chat request sent" };
}

export async function createGroupConversation(data: {
  name: string;
  participantIds: string[];
}): Promise<ActionState & { conversationId?: string }> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const isNotSuspended2 = await requireNotSuspended(session.user.id);
  if (!isNotSuspended2) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to create groups" };
  }

  const { name, participantIds } = data;
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { success: false, message: "Group name is required" };
  }
  if (trimmedName.length > 100) {
    return { success: false, message: "Group name too long (max 100 characters)" };
  }

  const uniqueIds = [...new Set(participantIds.filter((id) => id !== session.user!.id))];

  if (uniqueIds.length < 2) {
    return { success: false, message: "Groups need at least 2 other members" };
  }
  if (uniqueIds.length > 50) {
    return { success: false, message: "Groups can have at most 50 members" };
  }

  // Verify all users exist
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (users.length !== uniqueIds.length) {
    return { success: false, message: "Some users were not found" };
  }

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: true,
      name: trimmedName,
      participants: {
        create: [
          { userId: session.user.id, isAdmin: true },
          ...uniqueIds.map((id) => ({ userId: id })),
        ],
      },
    },
  });

  revalidatePath("/chat");
  return { success: true, message: "Group created", conversationId: conversation.id };
}

export async function sendMessage(data: {
  conversationId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaFileName?: string;
  mediaFileSize?: number;
  replyToId?: string;
}): Promise<ActionState & { messageId?: string }> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const isNotSuspended3 = await requireNotSuspended(session.user.id);
  if (!isNotSuspended3) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to send messages" };
  }

  const { conversationId, content, mediaUrl, mediaType, mediaFileName, mediaFileSize, replyToId } = data;
  const trimmedContent = content.trim();
  const hasMedia = !!mediaUrl;

  if (!trimmedContent && !hasMedia) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmedContent.length > 5000) {
    return { success: false, message: "Message too long (max 5000 characters)" };
  }
  if (hasMedia) {
    const validMediaTypes = ["image", "video", "audio", "document"];
    if (!mediaType || !validMediaTypes.includes(mediaType)) {
      return { success: false, message: "Invalid media type" };
    }
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }

  // Check for blocks between participants
  const otherParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: session.user.id } },
    select: { userId: true },
  });
  const blockedIds = await getAllBlockRelatedIds(session.user.id);
  const hasBlockedParticipant = otherParticipants.some((p: { userId: string }) =>
    blockedIds.includes(p.userId)
  );
  if (hasBlockedParticipant) {
    return { success: false, message: "Cannot send messages in this conversation" };
  }

  // Validate replyToId belongs to the same conversation
  let replyToData: MessageReplyTo | null = null;
  if (replyToId) {
    const replyTarget = await prisma.message.findUnique({
      where: { id: replyToId },
      include: {
        sender: {
          select: { displayName: true, username: true, name: true },
        },
      },
    });
    if (!replyTarget || replyTarget.conversationId !== conversationId) {
      return { success: false, message: "Reply target not found in this conversation" };
    }
    replyToData = formatReplyTo({
      id: replyTarget.id,
      content: replyTarget.content,
      senderId: replyTarget.senderId,
      deletedAt: replyTarget.deletedAt,
      mediaType: replyTarget.mediaType,
      sender: replyTarget.sender,
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      content: trimmedContent,
      ...(replyToId && { replyToId }),
      ...(hasMedia && {
        mediaUrl,
        mediaType,
        mediaFileName: mediaFileName ?? null,
        mediaFileSize: mediaFileSize ?? null,
      }),
    },
    include: { sender: { select: USER_PROFILE_SELECT } },
  });

  // Update conversation timestamp for ordering
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Mark as read for the sender
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
    data: { lastReadAt: new Date() },
  });

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${conversationId}`);
    await channel.publish("new", {
      id: message.id,
      conversationId,
      senderId: message.senderId,
      content: message.content,
      sender: JSON.stringify(message.sender),
      editedAt: null,
      deletedAt: null,
      createdAt: message.createdAt.toISOString(),
      mediaUrl: message.mediaUrl ?? null,
      mediaType: message.mediaType ?? null,
      mediaFileName: message.mediaFileName ?? null,
      mediaFileSize: message.mediaFileSize?.toString() ?? null,
      replyTo: replyToData ? JSON.stringify(replyToData) : null,
    });

    // Notify other participants for favicon/toast updates
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: session.user.id } },
      select: { userId: true },
    });
    for (const p of participants) {
      const notifyChannel = ably.channels.get(`chat-notify:${p.userId}`);
      await notifyChannel.publish("new", {
        conversationId,
        senderId: message.senderId,
      });
    }
  } catch {
    // Non-critical — message is saved, real-time delivery failed
  }

  return { success: true, message: "Message sent", messageId: message.id };
}

export async function editMessage(data: {
  messageId: string;
  content: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { messageId, content } = data;
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmedContent.length > 5000) {
    return { success: false, message: "Message too long (max 5000 characters)" };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) {
    return { success: false, message: "Message not found" };
  }
  if (message.senderId !== session.user.id) {
    return { success: false, message: "Can only edit your own messages" };
  }
  if (message.deletedAt) {
    return { success: false, message: "Cannot edit a deleted message" };
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: trimmedContent, editedAt: new Date() },
  });

  // Publish edit to Ably
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${message.conversationId}`);
    await channel.publish("edit", {
      id: messageId,
      content: trimmedContent,
      editedAt: updated.editedAt!.toISOString(),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message edited" };
}

export async function deleteMessage(messageId: string): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) {
    return { success: false, message: "Message not found" };
  }
  if (message.senderId !== session.user.id) {
    return { success: false, message: "Can only delete your own messages" };
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  // Publish delete to Ably
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${message.conversationId}`);
    await channel.publish("delete", {
      id: messageId,
      deletedAt: updated.deletedAt!.toISOString(),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message deleted" };
}

export async function markConversationRead(
  conversationId: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  // Publish read receipt to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`read:${conversationId}`);
    await channel.publish("read", {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical — DB updated, real-time delivery failed
  }

  return { success: true, message: "Marked as read" };
}

export async function acceptMessageRequest(
  requestId: string
): Promise<ActionState & { conversationId?: string }> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const request = await prisma.messageRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    return { success: false, message: "Request not found" };
  }
  if (request.receiverId !== session.user.id) {
    return { success: false, message: "Not your request" };
  }
  if (request.status !== "PENDING") {
    return { success: false, message: "Request already handled" };
  }

  // Accept the request and create conversation
  await prisma.messageRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED" },
  });

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: false,
      participants: {
        create: [
          { userId: session.user.id },
          { userId: request.senderId },
        ],
      },
    },
  });

  revalidatePath("/chat");
  return {
    success: true,
    message: "Request accepted",
    conversationId: conversation.id,
  };
}

export async function declineMessageRequest(
  requestId: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const request = await prisma.messageRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    return { success: false, message: "Request not found" };
  }
  if (request.receiverId !== session.user.id) {
    return { success: false, message: "Not your request" };
  }
  if (request.status !== "PENDING") {
    return { success: false, message: "Request already handled" };
  }

  await prisma.messageRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED" },
  });

  revalidatePath("/chat");
  return { success: true, message: "Request declined" };
}

export async function bulkDeclineMessageRequests(
  requestIds: string[]
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  if (!requestIds.length) {
    return { success: false, message: "No requests selected" };
  }

  const requests = await prisma.messageRequest.findMany({
    where: { id: { in: requestIds } },
    select: { id: true, receiverId: true, status: true },
  });

  const invalid = requests.filter(
    (r: { receiverId: string; status: string }) => r.receiverId !== session.user!.id || r.status !== "PENDING"
  );
  if (invalid.length > 0) {
    return { success: false, message: "Some requests are invalid" };
  }
  if (requests.length !== requestIds.length) {
    return { success: false, message: "Some requests not found" };
  }

  await prisma.messageRequest.updateMany({
    where: { id: { in: requestIds }, receiverId: session.user.id, status: "PENDING" },
    data: { status: "DECLINED" },
  });

  revalidatePath("/chat");
  return { success: true, message: `${requestIds.length} request(s) declined` };
}

export async function toggleReaction(data: {
  messageId: string;
  emoji: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { messageId, emoji } = data;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) {
    return { success: false, message: "Message not found" };
  }
  if (message.deletedAt) {
    return { success: false, message: "Cannot react to a deleted message" };
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId: session.user.id,
      },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }

  // Toggle: remove if exists, add if not
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: session.user.id,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId, userId: session.user.id, emoji },
    });

    // Notify message author about the reaction
    if (message.senderId !== session.user.id) {
      await createNotificationSafe({
        type: "REACTION",
        actorId: session.user.id,
        targetUserId: message.senderId,
        messageId,
      });
    }
  }

  // Fetch updated reactions for this message
  const reactions = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });

  // Publish to Ably
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${message.conversationId}`);
    await channel.publish("reaction", {
      messageId,
      reactions: JSON.stringify(groupReactions(reactions)),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: existing ? "Reaction removed" : "Reaction added" };
}

export async function getFriendsForChat(): Promise<ChatUserProfile[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    },
    include: {
      sender: { select: USER_PROFILE_SELECT },
      receiver: { select: USER_PROFILE_SELECT },
    },
  });

  return friendships.map((f) =>
    f.senderId === session.user!.id ? f.receiver : f.sender
  );
}

export async function searchUsers(
  query: string
): Promise<ChatUserProfile[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const blockedIds = await getAllBlockRelatedIds(session.user.id);

  return prisma.user.findMany({
    where: {
      id: { notIn: [session.user.id, ...blockedIds] },
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: USER_PROFILE_SELECT,
    take: 10,
  });
}

export async function updateGroupName(data: {
  conversationId: string;
  name: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { conversationId, name } = data;
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { success: false, message: "Group name is required" };
  }
  if (trimmedName.length > 100) {
    return { success: false, message: "Group name too long (max 100 characters)" };
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }
  if (!participant.isAdmin) {
    return { success: false, message: "Only admins can rename the group" };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { name: trimmedName },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${conversationId}`);
    await channel.publish("group-update", {
      type: "name",
      name: trimmedName,
    });
  } catch {
    // Non-critical
  }

  revalidatePath("/chat");
  return { success: true, message: "Group renamed" };
}

export async function addGroupMembers(data: {
  conversationId: string;
  userIds: string[];
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { conversationId, userIds } = data;
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    return { success: false, message: "No users selected" };
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }
  if (!participant.isAdmin) {
    return { success: false, message: "Only admins can add members" };
  }

  // Check current member count
  const currentCount = await prisma.conversationParticipant.count({
    where: { conversationId },
  });
  if (currentCount + uniqueIds.length > 50) {
    return { success: false, message: "Groups can have at most 50 members" };
  }

  // Verify users exist
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (users.length !== uniqueIds.length) {
    return { success: false, message: "Some users were not found" };
  }

  // Filter out users already in the group
  const existing = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { in: uniqueIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((e: { userId: string }) => e.userId));
  const newIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return { success: false, message: "All users are already members" };
  }

  await prisma.conversationParticipant.createMany({
    data: newIds.map((userId) => ({ conversationId, userId })),
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${conversationId}`);
    await channel.publish("group-update", {
      type: "members-added",
      userIds: newIds,
    });
  } catch {
    // Non-critical
  }

  revalidatePath("/chat");
  return { success: true, message: `${newIds.length} member(s) added` };
}

export async function removeGroupMember(data: {
  conversationId: string;
  userId: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { conversationId, userId } = data;

  if (userId === session.user.id) {
    return { success: false, message: "Cannot remove yourself" };
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }
  if (!participant.isAdmin) {
    return { success: false, message: "Only admins can remove members" };
  }

  const target = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  if (!target) {
    return { success: false, message: "User is not a member of this group" };
  }

  await prisma.conversationParticipant.delete({
    where: { id: target.id },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chat:${conversationId}`);
    await channel.publish("group-update", {
      type: "member-removed",
      userId,
    });
  } catch {
    // Non-critical
  }

  revalidatePath("/chat");
  return { success: true, message: "Member removed" };
}

export async function leaveConversation(
  conversationId: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chat");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: session.user.id },
    },
  });
  if (!participant) {
    return { success: false, message: "Not a participant of this conversation" };
  }

  await prisma.conversationParticipant.delete({
    where: { id: participant.id },
  });

  revalidatePath("/chat");
  return { success: true, message: "Conversation removed" };
}
