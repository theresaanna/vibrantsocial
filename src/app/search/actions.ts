"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/app/feed/feed-queries";

export async function searchUsers(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { users: [], hasMore: false };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { users: [], hasMore: false };

  const fetchCount = PAGE_SIZE + 1;

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      bio: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = users.length > PAGE_SIZE;
  return {
    users: users.slice(0, PAGE_SIZE),
    hasMore,
  };
}

export async function searchPosts(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { posts: [], hasMore: false };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { posts: [], hasMore: false };

  const fetchCount = PAGE_SIZE + 1;

  const posts = await prisma.post.findMany({
    where: {
      content: { contains: trimmed, mode: "insensitive" },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          image: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          reposts: true,
        },
      },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  return {
    posts: posts.slice(0, PAGE_SIZE),
    hasMore,
  };
}
