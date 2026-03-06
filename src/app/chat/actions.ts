"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePhoneVerification } from "@/lib/phone-gate";
import type {
  ActionState,
  ConversationListItem,
  MessageData,
  MessageRequestData,
  ChatUserProfile,
} from "@/types/chat";

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
} as const;

async function checkMutualFollow(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const [forward, reverse] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId1,
          followingId: userId2,
        },
      },
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId2,
          followingId: userId1,
        },
      },
    }),
  ]);
  return !!(forward && reverse);
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
            include: { user: { select: userSelect } },
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

  return participantRecords.map((pr) => {
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
    include: { sender: { select: userSelect } },
  });

  const hasMore = messages.length > 50;
  const trimmed = hasMore ? messages.slice(0, 50) : messages;

  return {
    messages: trimmed.reverse(),
    nextCursor: hasMore ? trimmed[0].id : null,
  };
}

export async function getMessageRequests(): Promise<MessageRequestData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.messageRequest.findMany({
    where: { receiverId: session.user.id, status: "PENDING" },
    include: { sender: { select: userSelect } },
    orderBy: { createdAt: "desc" },
  });
}

export async function startConversation(
  targetUserId: string
): Promise<ActionState & { conversationId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to start conversations" };
  }

  const userId = session.user.id;

  if (userId === targetUserId) {
    return { success: false, message: "Cannot message yourself" };
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

  // Check mutual follow (friends)
  const areFriends = await checkMutualFollow(userId, targetUserId);

  if (areFriends) {
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

export async function createGroupConversation(data: {
  name: string;
  participantIds: string[];
}): Promise<ActionState & { conversationId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
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
}): Promise<ActionState & { messageId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to send messages" };
  }

  const { conversationId, content } = data;
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmedContent.length > 5000) {
    return { success: false, message: "Message too long (max 5000 characters)" };
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

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      content: trimmedContent,
    },
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

  return { success: true, message: "Message sent", messageId: message.id };
}

export async function editMessage(data: {
  messageId: string;
  content: string;
}): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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

  await prisma.message.update({
    where: { id: messageId },
    data: { content: trimmedContent, editedAt: new Date() },
  });

  return { success: true, message: "Message edited" };
}

export async function deleteMessage(messageId: string): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) {
    return { success: false, message: "Message not found" };
  }
  if (message.senderId !== session.user.id) {
    return { success: false, message: "Can only delete your own messages" };
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  return { success: true, message: "Message deleted" };
}

export async function markConversationRead(
  conversationId: string
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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

  return { success: true, message: "Marked as read" };
}

export async function acceptMessageRequest(
  requestId: string
): Promise<ActionState & { conversationId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (!requestIds.length) {
    return { success: false, message: "No requests selected" };
  }

  const requests = await prisma.messageRequest.findMany({
    where: { id: { in: requestIds } },
    select: { id: true, receiverId: true, status: true },
  });

  const invalid = requests.filter(
    (r) => r.receiverId !== session.user!.id || r.status !== "PENDING"
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

export async function searchUsers(
  query: string
): Promise<ChatUserProfile[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  return prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: userSelect,
    take: 10,
  });
}
