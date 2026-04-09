"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cached, cacheKeys, invalidate } from "@/lib/cache";
import { revalidatePath } from "next/cache";
import {
  requireAuthWithRateLimit,
  isActionError,
  USER_PROFILE_SELECT,
  hasBlock,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

const MAX_STATUS_LENGTH = 100;
const STATUS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FriendStatusData {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
  user: {
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
// Set status
// ---------------------------------------------------------------------------

export async function setStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("status");
  if (isActionError(result)) return result;
  const userId = result.user.id;

  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (!content) return { success: false, message: "Status cannot be empty." };
  if (content.length > MAX_STATUS_LENGTH) {
    return { success: false, message: `Status must be ${MAX_STATUS_LENGTH} characters or fewer.` };
  }

  await prisma.userStatus.create({ data: { userId, content } });
  await invalidate(cacheKeys.friendStatuses(userId));
  revalidatePath("/feed");
  revalidatePath("/statuses");

  return { success: true, message: "Status updated!" };
}

// ---------------------------------------------------------------------------
// Set status and return data (for optimistic UI)
// ---------------------------------------------------------------------------

export async function setStatusAndReturn(
  content: string,
): Promise<FriendStatusData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_STATUS_LENGTH) return null;

  const status = await prisma.userStatus.create({
    data: { userId, content: trimmed },
    include: { user: { select: USER_PROFILE_SELECT } },
  });

  await invalidate(cacheKeys.friendStatuses(userId));
  revalidatePath("/feed");
  revalidatePath("/statuses");

  return {
    id: status.id,
    content: status.content,
    createdAt: status.createdAt.toISOString(),
    likeCount: 0,
    isLiked: false,
    user: status.user,
  };
}

// ---------------------------------------------------------------------------
// Delete status
// ---------------------------------------------------------------------------

export async function deleteStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("status");
  if (isActionError(result)) return result;
  const userId = result.user.id;

  const statusId = formData.get("statusId") as string | null;
  if (!statusId) return { success: false, message: "Missing status ID." };

  const status = await prisma.userStatus.findUnique({
    where: { id: statusId },
    select: { userId: true },
  });
  if (!status) return { success: false, message: "Status not found." };
  if (status.userId !== userId) {
    return { success: false, message: "You can only delete your own statuses." };
  }

  await prisma.userStatus.delete({ where: { id: statusId } });
  await invalidate(cacheKeys.friendStatuses(userId));
  revalidatePath("/statuses");

  return { success: true, message: "Status deleted." };
}

// ---------------------------------------------------------------------------
// Toggle status like
// ---------------------------------------------------------------------------

export async function toggleStatusLike(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("status");
  if (isActionError(result)) return result;
  const userId = result.user.id;

  const statusId = formData.get("statusId") as string | null;
  if (!statusId) return { success: false, message: "Missing status ID." };

  const existing = await prisma.statusLike.findUnique({
    where: { statusId_userId: { statusId, userId } },
  });

  if (existing) {
    await prisma.statusLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.statusLike.create({ data: { statusId, userId } });
  }

  revalidatePath("/feed");
  revalidatePath("/statuses");

  return { success: true, message: existing ? "Unliked" : "Liked" };
}

// ---------------------------------------------------------------------------
// Get friend statuses (for feed widget + /statuses page)
// ---------------------------------------------------------------------------

// Shared include for status queries with like data
function statusInclude(currentUserId: string) {
  return {
    user: { select: USER_PROFILE_SELECT },
    _count: { select: { likes: true } },
    likes: { where: { userId: currentUserId }, select: { id: true } },
  } as const;
}

type StatusRow = {
  id: string;
  content: string;
  createdAt: Date;
  user: FriendStatusData["user"];
  _count: { likes: number };
  likes: { id: string }[];
};

function toStatusData(s: StatusRow): FriendStatusData {
  return {
    id: s.id,
    content: s.content,
    createdAt: s.createdAt.toISOString(),
    likeCount: s._count.likes,
    isLiked: s.likes.length > 0,
    user: s.user,
  };
}

export async function getFriendStatuses(
  limit = 10,
): Promise<FriendStatusData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  // Get accepted friend IDs (cached)
  const friendIds = await cached(
    cacheKeys.friendStatuses(userId) + ":ids",
    async () => {
      const friendships = await prisma.friendRequest.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: { senderId: true, receiverId: true },
      });

      return friendships.map((f: { senderId: string; receiverId: string }) =>
        f.senderId === userId ? f.receiverId : f.senderId,
      );
    },
    60,
  );

  if (friendIds.length === 0) return [];

  const twoWeeksAgo = new Date(Date.now() - STATUS_TTL_MS);

  const statuses = await prisma.userStatus.findMany({
    where: { userId: { in: friendIds }, createdAt: { gte: twoWeeksAgo } },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    take: limit,
    include: statusInclude(userId),
  });

  return statuses.map((s: StatusRow) => toStatusData(s));
}

// ---------------------------------------------------------------------------
// Poll statuses (own + friends, for client-side polling)
// ---------------------------------------------------------------------------

export async function pollStatuses(
  friendLimit = 10,
): Promise<{ ownStatus: FriendStatusData | null; friendStatuses: FriendStatusData[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ownStatus: null, friendStatuses: [] };
  const userId = session.user.id;

  const twoWeeksAgo = new Date(Date.now() - STATUS_TTL_MS);

  const [ownStatuses, friendStatuses] = await Promise.all([
    prisma.userStatus.findMany({
      where: { userId, createdAt: { gte: twoWeeksAgo } },
      orderBy: { createdAt: "desc" },
      take: 1,
      include: statusInclude(userId),
    }),
    getFriendStatuses(friendLimit),
  ]);

  const ownStatus = ownStatuses[0]
    ? toStatusData(ownStatuses[0] as StatusRow)
    : null;

  return { ownStatus, friendStatuses };
}

// ---------------------------------------------------------------------------
// Get user status history (for /statuses/[username])
// ---------------------------------------------------------------------------

export async function getUserStatusHistory(
  username: string,
  limit = 30,
): Promise<FriendStatusData[]> {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) return [];

  // Block check
  if (currentUserId && currentUserId !== user.id) {
    if (await hasBlock(currentUserId, user.id)) return [];
  }

  const statuses = await prisma.userStatus.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: statusInclude(currentUserId),
  });

  return statuses.map((s: StatusRow) => toStatusData(s));
}
