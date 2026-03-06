"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface FollowState {
  success: boolean;
  message: string;
}

export async function toggleFollow(
  _prevState: FollowState,
  formData: FormData
): Promise<FollowState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const targetUserId = formData.get("userId") as string;

  if (targetUserId === session.user.id) {
    return { success: false, message: "Cannot follow yourself" };
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: targetUserId,
      },
    },
  });

  if (existing) {
    // Remove both directions of the friendship
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: targetUserId },
          { followerId: targetUserId, followingId: session.user.id },
        ],
      },
    });
  } else {
    // Create mutual follows (friendship)
    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId: session.user.id, followingId: targetUserId },
      }),
      prisma.follow.create({
        data: { followerId: targetUserId, followingId: session.user.id },
      }),
    ]);
  }

  revalidatePath("/feed");
  return { success: true, message: existing ? "Removed friend" : "Added friend" };
}
