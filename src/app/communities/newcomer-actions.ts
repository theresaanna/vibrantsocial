"use server";

import { prisma } from "@/lib/prisma";

export async function fetchNewcomers() {
  const users = await prisma.user.findMany({
    where: {
      username: { not: null },
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
