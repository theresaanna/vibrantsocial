import { prisma } from "@/lib/prisma";
import { cached, cacheKeys, invalidateMany } from "@/lib/cache";
import type { LinkedAccount } from "@/types/next-auth";

export async function loadLinkedAccounts(
  userId: string
): Promise<LinkedAccount[]> {
  return cached(cacheKeys.linkedAccounts(userId), async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { linkedAccountGroupId: true },
    });

    if (!user?.linkedAccountGroupId) return [];

    const members = await prisma.user.findMany({
      where: {
        linkedAccountGroupId: user.linkedAccountGroupId,
        id: { not: userId },
      },
      select: { id: true, username: true, displayName: true, avatar: true, profileFrameId: true, usernameFont: true },
    });

    return members;
  }, 60);
}

/**
 * Bust the `linkedAccounts` cache for every user reachable from `userIds`
 * via current group membership. Call this after any mutation that adds,
 * removes, or merges members of a linked-account group, so other devices
 * for those users see the change before the 60s TTL would expire.
 *
 * Pass IDs of every user touched by the mutation (both sides of a link, or
 * the user being unlinked plus the user staying behind).
 */
export async function invalidateLinkedAccountsCacheForGroup(
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const seedUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, linkedAccountGroupId: true },
  });
  const groupIds = Array.from(
    new Set(
      seedUsers
        .map((u) => u.linkedAccountGroupId)
        .filter((id): id is string => !!id),
    ),
  );
  const toInvalidate = new Set<string>(userIds);
  if (groupIds.length > 0) {
    const members = await prisma.user.findMany({
      where: { linkedAccountGroupId: { in: groupIds } },
      select: { id: true },
    });
    for (const m of members) toInvalidate.add(m.id);
  }

  await invalidateMany(
    Array.from(toInvalidate).map((id) => cacheKeys.linkedAccounts(id)),
  );
}

export async function linkUsersInGroup(userIdA: string, userIdB: string) {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userIdA },
      select: { linkedAccountGroupId: true },
    }),
    prisma.user.findUnique({
      where: { id: userIdB },
      select: { linkedAccountGroupId: true },
    }),
  ]);

  if (!userA || !userB) return;

  const groupA = userA.linkedAccountGroupId;
  const groupB = userB.linkedAccountGroupId;

  // Already in the same group
  if (groupA && groupA === groupB) return;

  if (!groupA && !groupB) {
    const group = await prisma.linkedAccountGroup.create({ data: {} });
    await prisma.user.updateMany({
      where: { id: { in: [userIdA, userIdB] } },
      data: { linkedAccountGroupId: group.id },
    });
  } else if (groupA && !groupB) {
    await prisma.user.update({
      where: { id: userIdB },
      data: { linkedAccountGroupId: groupA },
    });
  } else if (!groupA && groupB) {
    await prisma.user.update({
      where: { id: userIdA },
      data: { linkedAccountGroupId: groupB },
    });
  } else if (groupA && groupB) {
    await prisma.user.updateMany({
      where: { linkedAccountGroupId: groupB },
      data: { linkedAccountGroupId: groupA },
    });
    await prisma.linkedAccountGroup.delete({ where: { id: groupB } });
  }
}
