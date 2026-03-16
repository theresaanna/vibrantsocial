import { prisma } from "@/lib/prisma";
import type { LinkedAccount } from "@/types/next-auth";

export async function loadLinkedAccounts(
  userId: string
): Promise<LinkedAccount[]> {
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
    select: { id: true, username: true, displayName: true, avatar: true, profileFrameId: true },
  });

  return members;
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
