"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import type { FollowUser } from "@/app/feed/follow-actions";

interface FriendActionState {
  success: boolean;
  message: string;
}

export type FriendshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends";

export async function getFriendshipStatus(
  targetUserId: string
): Promise<{ status: FriendshipStatus; requestId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { status: "none" };

  const request = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: session.user.id, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: session.user.id },
      ],
    },
    select: { id: true, senderId: true, status: true },
  });

  if (!request) return { status: "none" };
  if (request.status === "ACCEPTED") return { status: "friends", requestId: request.id };
  if (request.senderId === session.user.id) return { status: "pending_sent", requestId: request.id };
  return { status: "pending_received", requestId: request.id };
}

export async function sendFriendRequest(
  _prevState: FriendActionState,
  formData: FormData
): Promise<FriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.user.id) {
    return { success: false, message: "Cannot friend yourself" };
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: session.user.id, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: session.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return { success: false, message: "Already friends" };
    }
    return { success: false, message: "Friend request already pending" };
  }

  await prisma.friendRequest.create({
    data: { senderId: session.user.id, receiverId: targetUserId },
  });

  try {
    await createNotification({
      type: "FRIEND_REQUEST",
      actorId: session.user.id,
      targetUserId,
    });
  } catch {
    // Non-critical
  }

  // Send email notification
  try {
    const [receiver, sender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { email: true, emailOnFriendRequest: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, username: true, name: true },
      }),
    ]);

    if (receiver?.email && receiver.emailOnFriendRequest) {
      const senderName =
        sender?.displayName ?? sender?.username ?? sender?.name ?? "Someone";
      await inngest.send({
        name: "email/friend-request",
        data: { toEmail: receiver.email, senderName },
      });
    }
  } catch {
    // Non-critical
  }

  revalidatePath("/");
  return { success: true, message: "Friend request sent" };
}

export async function acceptFriendRequest(
  _prevState: FriendActionState,
  formData: FormData
): Promise<FriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const requestId = formData.get("requestId") as string;

  const request = await prisma.friendRequest.findUnique({
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

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED" },
  });

  try {
    await createNotification({
      type: "FRIEND_REQUEST",
      actorId: session.user.id,
      targetUserId: request.senderId,
    });
  } catch {
    // Non-critical
  }

  revalidatePath("/");
  return { success: true, message: "Friend request accepted" };
}

export async function declineFriendRequest(
  _prevState: FriendActionState,
  formData: FormData
): Promise<FriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const requestId = formData.get("requestId") as string;

  const request = await prisma.friendRequest.findUnique({
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

  // Delete so the sender can re-request later
  await prisma.friendRequest.delete({ where: { id: requestId } });

  revalidatePath("/");
  return { success: true, message: "Friend request declined" };
}

export async function removeFriend(
  _prevState: FriendActionState,
  formData: FormData
): Promise<FriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const targetUserId = formData.get("userId") as string;

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: session.user.id, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: session.user.id },
      ],
    },
  });

  if (!friendship) {
    return { success: false, message: "Not friends" };
  }

  await prisma.friendRequest.delete({ where: { id: friendship.id } });

  revalidatePath("/");
  return { success: true, message: "Friend removed" };
}

export async function getPendingFriendRequests() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.friendRequest.findMany({
    where: {
      receiverId: session.user.id,
      status: "PENDING",
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

const friendUserSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
} as const;

export async function getFriendsCount(userId: string): Promise<number> {
  return prisma.friendRequest.count({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
  });
}

export async function getFriends(username: string): Promise<FollowUser[]> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) return [];

  const session = await auth();
  const currentUserId = session?.user?.id;

  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: user.id }, { receiverId: user.id }],
    },
    include: {
      sender: { select: friendUserSelect },
      receiver: { select: friendUserSelect },
    },
    orderBy: { createdAt: "desc" },
  });

  // For each friendship, return the "other" user
  const friends = friendships.map((f) =>
    f.senderId === user.id ? f.receiver : f.sender
  );

  let currentUserFollowingIds = new Set<string>();
  if (currentUserId) {
    const myFollows = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    currentUserFollowingIds = new Set(myFollows.map((f) => f.followingId));
  }

  return friends.map((friend) => ({
    ...friend,
    isFollowing: currentUserFollowingIds.has(friend.id),
  }));
}
