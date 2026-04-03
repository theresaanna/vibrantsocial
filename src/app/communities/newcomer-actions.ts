"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

export async function fetchNewcomers() {
  const session = await auth();
  const blockedIds = session?.user?.id
    ? await getAllBlockRelatedIds(session.user.id)
    : [];

  const users = await prisma.user.findMany({
    where: {
      username: { not: null },
      ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      profileFrameId: true,
      usernameFont: true,
      bio: true,
      _count: {
        select: {
          followers: true,
          posts: true,
        },
      },
    },
  });

  return JSON.parse(JSON.stringify(users));
}
