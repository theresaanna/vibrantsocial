"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrefs } from "@/lib/user-prefs";

export async function fetchAllUserLists() {
  const session = await auth();
  let hideNsfw = true;
  let viewerId: string | null = null;
  if (session?.user?.id) {
    viewerId = session.user.id;
    const prefs = await getUserPrefs(viewerId);
    hideNsfw = !prefs.showNsfwContent;
  }

  const lists = await prisma.userList.findMany({
    where: hideNsfw
      ? {
          OR: [
            { isNsfw: false },
            ...(viewerId ? [{ ownerId: viewerId }] : []),
          ],
        }
      : {},
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          image: true,
        },
      },
      _count: { select: { members: true, subscriptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return lists;
}
