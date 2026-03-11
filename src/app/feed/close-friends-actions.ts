"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface CloseFriendActionState {
  success: boolean;
  message: string;
}

export async function addCloseFriend(
  _prevState: CloseFriendActionState,
  formData: FormData
): Promise<CloseFriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const friendId = formData.get("friendId") as string;
  if (!friendId) {
    return { success: false, message: "Friend ID required" };
  }

  if (friendId === session.user.id) {
    return { success: false, message: "Cannot add yourself" };
  }

  // Verify they are actually friends (accepted friend request)
  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: session.user.id, receiverId: friendId },
        { senderId: friendId, receiverId: session.user.id },
      ],
    },
  });

  if (!friendship) {
    return { success: false, message: "You must be friends first" };
  }

  const existing = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId: session.user.id, friendId } },
  });

  if (existing) {
    return { success: false, message: "Already on your close friends list" };
  }

  await prisma.closeFriend.create({
    data: { userId: session.user.id, friendId },
  });

  revalidatePath("/close-friends");
  return { success: true, message: "Added to close friends" };
}

export async function removeCloseFriend(
  _prevState: CloseFriendActionState,
  formData: FormData
): Promise<CloseFriendActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const friendId = formData.get("friendId") as string;
  if (!friendId) {
    return { success: false, message: "Friend ID required" };
  }

  const existing = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId: session.user.id, friendId } },
  });

  if (!existing) {
    return { success: false, message: "Not on your close friends list" };
  }

  await prisma.closeFriend.delete({ where: { id: existing.id } });

  revalidatePath("/close-friends");
  return { success: true, message: "Removed from close friends" };
}

export async function getCloseFriends() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.closeFriend.findMany({
    where: { userId: session.user.id },
    include: {
      friend: {
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

export async function getCloseFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.closeFriend.findMany({
    where: { userId },
    select: { friendId: true },
  });
  return rows.map((r) => r.friendId);
}

export async function isCloseFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
  const record = await prisma.closeFriend.findUnique({
    where: { userId_friendId: { userId, friendId } },
  });
  return !!record;
}

export async function getAcceptedFriends() {
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
      receiver: {
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
    orderBy: { updatedAt: "desc" },
  });

  // Return the other person in each friendship
  return friendships.map((f) =>
    f.senderId === session.user!.id ? f.receiver : f.sender
  );
}
