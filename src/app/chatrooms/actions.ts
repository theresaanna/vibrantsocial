"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import {
  requireAuthWithRateLimit,
  isActionError,
  USER_PROFILE_SELECT,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

const MAX_CONTENT_LENGTH = 2000;
const MAX_STATUS_LENGTH = 200;
const PAGE_SIZE = 40;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatRoomMessageData {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  isNsfw: boolean;
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
  replyTo: {
    id: string;
    content: string;
    senderId: string;
    deletedAt: Date | null;
    sender: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
    };
  } | null;
  reactions: { emoji: string; userIds: string[] }[];
}

export interface ChatRoomMeta {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  isNsfw: boolean;
  ownerId: string;
  moderatorIds: string[];
  mutes: { userId: string; expiresAt: Date | null }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateRoom(slug: string) {
  let room = await prisma.chatRoom.findFirst({ where: { slug } });
  if (!room) {
    // Auto-create room with "theresa" as the default owner
    const owner = await prisma.user.findFirst({
      where: { username: { equals: "theresa", mode: "insensitive" } },
      select: { id: true },
    });
    if (!owner) throw new Error("Default room owner (theresa) not found");
    room = await prisma.chatRoom.create({
      data: { slug, name: slug === "lobby" ? "Lounge" : slug, ownerId: owner.id },
    });
  }
  return room;
}

async function isModeratorOrOwner(roomId: string, userId: string): Promise<boolean> {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, select: { ownerId: true } });
  if (room?.ownerId === userId) return true;
  const mod = await prisma.chatRoomModerator.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  return !!mod;
}

async function isUserMuted(roomId: string, userId: string): Promise<boolean> {
  const mute = await prisma.chatRoomMute.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!mute) return false;
  // Check expiry
  if (mute.expiresAt && mute.expiresAt < new Date()) {
    // Expired — clean up
    await prisma.chatRoomMute.delete({ where: { id: mute.id } });
    return false;
  }
  return true;
}

function extractMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_]{3,30})/g;
  const usernames = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    usernames.add(match[1].toLowerCase());
  }
  return Array.from(usernames);
}

function groupReactions(
  reactions: { emoji: string; userId: string }[]
): { emoji: string; userIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = map.get(r.emoji) || [];
    arr.push(r.userId);
    map.set(r.emoji, arr);
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, userIds }));
}

// ---------------------------------------------------------------------------
// Get messages
// ---------------------------------------------------------------------------

export async function getChatRoomMessages(
  roomSlug: string = "lobby",
  cursor?: string
): Promise<{ messages: ChatRoomMessageData[]; nextCursor: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { messages: [], nextCursor: null };

  const room = await getOrCreateRoom(roomSlug);

  const messages = await prisma.chatRoomMessage.findMany({
    where: {
      roomId: room.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: USER_PROFILE_SELECT },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: { select: { id: true, username: true, displayName: true, name: true } },
        },
      },
      reactions: { select: { emoji: true, userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });

  const hasMore = messages.length > PAGE_SIZE;
  const page = hasMore ? messages.slice(0, PAGE_SIZE) : messages;

  // Chronological order (oldest first)
  const chronological = page.reverse();

  const result: ChatRoomMessageData[] = chronological.map((msg) => ({
    id: msg.id,
    roomId: msg.roomId,
    senderId: msg.senderId,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    mediaFileName: msg.mediaFileName,
    mediaFileSize: msg.mediaFileSize,
    isNsfw: msg.isNsfw,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
    sender: msg.sender,
    replyTo: msg.replyTo
      ? {
          id: msg.replyTo.id,
          content: msg.replyTo.content,
          senderId: msg.replyTo.senderId,
          deletedAt: msg.replyTo.deletedAt,
          sender: msg.replyTo.sender,
        }
      : null,
    reactions: groupReactions(msg.reactions),
  }));

  return {
    messages: JSON.parse(JSON.stringify(result)),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Get room metadata
// ---------------------------------------------------------------------------

export async function getChatRoomMeta(roomSlug: string = "lobby"): Promise<ChatRoomMeta> {
  const room = await getOrCreateRoom(roomSlug);

  const [moderators, mutes] = await Promise.all([
    prisma.chatRoomModerator.findMany({
      where: { roomId: room.id },
      select: { userId: true },
    }),
    prisma.chatRoomMute.findMany({
      where: { roomId: room.id },
      select: { userId: true, expiresAt: true },
    }),
  ]);

  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    status: room.status,
    isNsfw: room.isNsfw,
    ownerId: room.ownerId,
    moderatorIds: moderators.map((m) => m.userId),
    mutes: mutes.map((m) => ({ userId: m.userId, expiresAt: m.expiresAt })),
  };
}

// ---------------------------------------------------------------------------
// Send message
// ---------------------------------------------------------------------------

export async function sendChatRoomMessage(
  content: string,
  roomSlug: string = "lobby",
  options?: {
    mediaUrl?: string;
    mediaType?: string;
    mediaFileName?: string;
    mediaFileSize?: number;
    isNsfw?: boolean;
    replyToId?: string;
  }
): Promise<ActionState & { messageId?: string }> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const trimmed = content.trim();
  // Allow empty content if media is attached
  if (!trimmed && !options?.mediaUrl) {
    return { success: false, message: "Message cannot be empty" };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, message: `Message too long (max ${MAX_CONTENT_LENGTH} characters)` };
  }

  const room = await getOrCreateRoom(roomSlug);

  // Check mute status
  if (await isUserMuted(room.id, session.user.id)) {
    return { success: false, message: "You are muted in this chat room" };
  }

  const message = await prisma.chatRoomMessage.create({
    data: {
      roomId: room.id,
      senderId: session.user.id,
      content: trimmed,
      mediaUrl: options?.mediaUrl ?? null,
      mediaType: options?.mediaType ?? null,
      mediaFileName: options?.mediaFileName ?? null,
      mediaFileSize: options?.mediaFileSize ?? null,
      isNsfw: options?.isNsfw ?? false,
      replyToId: options?.replyToId ?? null,
    },
    include: {
      sender: { select: USER_PROFILE_SELECT },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: { select: { id: true, username: true, displayName: true, name: true } },
        },
      },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  // Publish to Ably
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${roomSlug}`);
    await channel.publish("new", JSON.stringify({
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      mediaFileName: message.mediaFileName,
      mediaFileSize: message.mediaFileSize,
      isNsfw: message.isNsfw,
      sender: message.sender,
      replyTo: message.replyTo
        ? {
            id: message.replyTo.id,
            content: message.replyTo.content,
            senderId: message.replyTo.senderId,
            deletedAt: message.replyTo.deletedAt,
            sender: message.replyTo.sender,
          }
        : null,
      reactions: [],
      editedAt: null,
      deletedAt: null,
      createdAt: message.createdAt.toISOString(),
    }));
  } catch {
    // Non-critical
  }

  // Handle @mentions
  if (trimmed) {
    const mentionedUsernames = extractMentions(trimmed);
    if (mentionedUsernames.length > 0) {
      const users = await prisma.user.findMany({
        where: { username: { in: mentionedUsernames, mode: "insensitive" } },
        select: { id: true },
      });
      await Promise.all(
        users
          .filter((u) => u.id !== session.user.id)
          .map((u) =>
            createNotification({
              type: "CHATROOM_MENTION",
              actorId: session.user.id,
              targetUserId: u.id,
              messageId: message.id,
            })
          )
      );
    }
  }

  // Trigger moderation scan for messages with media
  if (message.mediaUrl && (message.mediaType === "image" || message.mediaType === "video")) {
    try {
      await inngest.send({
        name: "moderation/scan-chatroom-message",
        data: { messageId: message.id, senderId: session.user.id, roomSlug },
      });
    } catch {
      // Non-critical
    }
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
  if (!trimmed) return { success: false, message: "Message cannot be empty" };
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, message: `Message too long (max ${MAX_CONTENT_LENGTH} characters)` };
  }

  const existing = await prisma.chatRoomMessage.findUnique({
    where: { id: messageId },
    include: { room: { select: { slug: true } } },
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
    const channel = ably.channels.get(`chatroom:${existing.room.slug}`);
    await channel.publish("edit", JSON.stringify({
      id: messageId,
      content: trimmed,
      editedAt: updated.editedAt!.toISOString(),
    }));
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message edited" };
}

// ---------------------------------------------------------------------------
// Delete message (own or moderator)
// ---------------------------------------------------------------------------

export async function deleteChatRoomMessage(messageId: string): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const existing = await prisma.chatRoomMessage.findUnique({
    where: { id: messageId },
    include: { room: { select: { id: true, slug: true } } },
  });
  if (!existing) return { success: false, message: "Message not found" };

  const isOwnMessage = existing.senderId === session.user.id;
  const isMod = await isModeratorOrOwner(existing.room.id, session.user.id);

  if (!isOwnMessage && !isMod) {
    return { success: false, message: "Not authorized to delete this message" };
  }

  const now = new Date();
  await prisma.chatRoomMessage.update({
    where: { id: messageId },
    data: { deletedAt: now },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${existing.room.slug}`);
    await channel.publish("delete", JSON.stringify({ id: messageId, deletedAt: now.toISOString() }));
  } catch {
    // Non-critical
  }

  return { success: true, message: "Message deleted" };
}

// ---------------------------------------------------------------------------
// Toggle reaction
// ---------------------------------------------------------------------------

export async function toggleReaction(
  messageId: string,
  emoji: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const message = await prisma.chatRoomMessage.findUnique({
    where: { id: messageId },
    include: { room: { select: { slug: true } } },
  });
  if (!message || message.deletedAt) {
    return { success: false, message: "Message not found" };
  }

  const existing = await prisma.chatRoomMessageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: session.user.id, emoji } },
  });

  if (existing) {
    await prisma.chatRoomMessageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatRoomMessageReaction.create({
      data: { messageId, userId: session.user.id, emoji },
    });
  }

  // Fetch updated reactions for this message
  const reactions = await prisma.chatRoomMessageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${message.room.slug}`);
    await channel.publish("reaction", JSON.stringify({
      messageId,
      reactions: groupReactions(reactions),
    }));
  } catch {
    // Non-critical
  }

  return { success: true, message: existing ? "Reaction removed" : "Reaction added" };
}

// ---------------------------------------------------------------------------
// Moderator management
// ---------------------------------------------------------------------------

export async function addModerator(roomSlug: string, userId: string): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const room = await getOrCreateRoom(roomSlug);
  if (room.ownerId !== session.user.id) {
    return { success: false, message: "Only the room owner can add moderators" };
  }

  await prisma.chatRoomModerator.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId },
    update: {},
  });

  return { success: true, message: "Moderator added" };
}

export async function removeModerator(roomSlug: string, userId: string): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const room = await getOrCreateRoom(roomSlug);
  if (room.ownerId !== session.user.id) {
    return { success: false, message: "Only the room owner can remove moderators" };
  }

  await prisma.chatRoomModerator.deleteMany({
    where: { roomId: room.id, userId },
  });

  return { success: true, message: "Moderator removed" };
}

// ---------------------------------------------------------------------------
// Mute / Unmute
// ---------------------------------------------------------------------------

export async function muteUser(
  roomSlug: string,
  userId: string,
  durationMinutes?: number
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const room = await getOrCreateRoom(roomSlug);
  if (!(await isModeratorOrOwner(room.id, session.user.id))) {
    return { success: false, message: "Not authorized to mute users" };
  }

  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  await prisma.chatRoomMute.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId, mutedById: session.user.id, expiresAt },
    update: { mutedById: session.user.id, expiresAt },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${roomSlug}`);
    await channel.publish("mute", JSON.stringify({ userId, expiresAt: expiresAt?.toISOString() ?? null }));
  } catch {
    // Non-critical
  }

  return { success: true, message: "User muted" };
}

export async function unmuteUser(roomSlug: string, userId: string): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const room = await getOrCreateRoom(roomSlug);
  if (!(await isModeratorOrOwner(room.id, session.user.id))) {
    return { success: false, message: "Not authorized to unmute users" };
  }

  await prisma.chatRoomMute.deleteMany({
    where: { roomId: room.id, userId },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${roomSlug}`);
    await channel.publish("unmute", JSON.stringify({ userId }));
  } catch {
    // Non-critical
  }

  return { success: true, message: "User unmuted" };
}

// ---------------------------------------------------------------------------
// Set status
// ---------------------------------------------------------------------------

export async function setChatRoomStatus(
  roomSlug: string,
  status: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("chatroom");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const room = await getOrCreateRoom(roomSlug);
  if (!(await isModeratorOrOwner(room.id, session.user.id))) {
    return { success: false, message: "Not authorized to set status" };
  }

  const trimmed = status.trim().slice(0, MAX_STATUS_LENGTH);

  await prisma.chatRoom.update({
    where: { id: room.id },
    data: { status: trimmed || null },
  });

  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`chatroom:${roomSlug}`);
    await channel.publish("status", JSON.stringify({ status: trimmed || null }));
  } catch {
    // Non-critical
  }

  return { success: true, message: "Status updated" };
}

// ---------------------------------------------------------------------------
// Search users (for @mention autocomplete)
// ---------------------------------------------------------------------------

export async function searchChatRoomUsers(
  query: string
): Promise<{ id: string; username: string | null; displayName: string | null; name: string | null; avatar: string | null; image: string | null; profileFrameId: string | null; usernameFont: string | null }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 1) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: USER_PROFILE_SELECT,
    take: 10,
  });

  return users;
}

// ---------------------------------------------------------------------------
// Fetch user profiles by IDs (for online sidebar)
// ---------------------------------------------------------------------------

export async function getUserProfiles(
  userIds: string[]
): Promise<{ id: string; username: string | null; displayName: string | null; name: string | null; avatar: string | null; image: string | null; profileFrameId: string | null; usernameFont: string | null }[]> {
  const session = await auth();
  if (!session?.user?.id || userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: USER_PROFILE_SELECT,
  });

  return users;
}

// ---------------------------------------------------------------------------
// List all chat rooms
// ---------------------------------------------------------------------------

export interface ChatRoomListItem {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  isNsfw: boolean;
  messageCount: number;
  lastMessageAt: string | null;
}

/**
 * List chat rooms. NSFW rooms are excluded unless `showNsfw` is true.
 */
export async function listChatRooms(showNsfw = false): Promise<ChatRoomListItem[]> {
  const rooms = await prisma.chatRoom.findMany({
    where: showNsfw ? {} : { isNsfw: false },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      isNsfw: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rooms.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    status: r.status,
    isNsfw: r.isNsfw,
    messageCount: r._count.messages,
    lastMessageAt: r.messages[0]?.createdAt?.toISOString() ?? null,
  }));
}
