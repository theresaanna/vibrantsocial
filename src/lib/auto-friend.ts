import { prisma } from "@/lib/prisma";

const AUTO_FRIEND_USERNAME = "theresa";

/**
 * Auto-friend a new user with the default account so they have content
 * and a connection right away. Creates mutual follows.
 */
export async function autoFriendNewUser(userId: string): Promise<boolean> {
  try {
    const defaultUser = await prisma.user.findUnique({
      where: { username: AUTO_FRIEND_USERNAME },
      select: { id: true },
    });
    if (!defaultUser || defaultUser.id === userId) return false;

    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId: userId, followingId: defaultUser.id },
      }),
      prisma.follow.create({
        data: { followerId: defaultUser.id, followingId: userId },
      }),
    ]);
    return true;
  } catch {
    // Non-critical — don't block signup if auto-friend fails
    return false;
  }
}
