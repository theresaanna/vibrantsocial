"use server";

import { prisma } from "@/lib/prisma";

export async function fetchAllUserLists() {
  const lists = await prisma.userList.findMany({
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
