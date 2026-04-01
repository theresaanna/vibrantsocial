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

const MAX_STATUS_LENGTH = 280;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FriendStatusData {
  id: string;
  content: string;
  createdAt: string;
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
// Get friend statuses (for feed widget + /statuses page)
// ---------------------------------------------------------------------------

export async function getFriendStatuses(
  limit = 10,
): Promise<FriendStatusData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  return cached(
    cacheKeys.friendStatuses(userId),
    async () => {
      // Get accepted friend IDs
      const friendships = await prisma.friendRequest.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: { senderId: true, receiverId: true },
      });

      const friendIds = friendships.map((f: { senderId: string; receiverId: string }) =>
        f.senderId === userId ? f.receiverId : f.senderId,
      );
      if (friendIds.length === 0) return [];

      const statuses = await prisma.userStatus.findMany({
        where: { userId: { in: friendIds } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: USER_PROFILE_SELECT } },
      });

      return statuses.map((s: { id: string; content: string; createdAt: Date; user: FriendStatusData["user"] }) => ({
        id: s.id,
        content: s.content,
        createdAt: s.createdAt.toISOString(),
        user: s.user,
      }));
    },
    60,
  );
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

  const [ownStatuses, friendStatuses] = await Promise.all([
    prisma.userStatus.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1,
      include: { user: { select: USER_PROFILE_SELECT } },
    }),
    getFriendStatuses(friendLimit),
  ]);

  const ownStatus = ownStatuses[0]
    ? {
        id: ownStatuses[0].id,
        content: ownStatuses[0].content,
        createdAt: ownStatuses[0].createdAt.toISOString(),
        user: ownStatuses[0].user,
      }
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
  const currentUserId = session?.user?.id;

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
    include: { user: { select: USER_PROFILE_SELECT } },
  });

  return statuses.map((s: { id: string; content: string; createdAt: Date; user: FriendStatusData["user"] }) => ({
    id: s.id,
    content: s.content,
    createdAt: s.createdAt.toISOString(),
    user: s.user,
  }));
}
