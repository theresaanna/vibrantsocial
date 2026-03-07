"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPostInclude, repostUserSelect, PAGE_SIZE } from "./feed-queries";

export async function fetchSinglePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: getPostInclude(session.user.id),
  });
  if (!post) return null;

  return {
    type: "post" as const,
    data: JSON.parse(JSON.stringify(post)),
    date: post.createdAt.toISOString(),
  };
}

export async function fetchFeedPage(cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { items: [] as any[], hasMore: false };
  }

  const userId = session.user.id;

  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = following.map((f: { followingId: string }) => f.followingId);

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    include: postInclude,
  });

  const reposts = await prisma.repost.findMany({
    where: {
      userId: { in: followingIds },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    include: {
      user: { select: repostUserSelect },
      post: { include: postInclude },
    },
  });

  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter((r: { post: { id: string } }) => !directPostIds.has(r.post.id));

  const allItems = [
    ...posts.map((p: { createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r: { createdAt: Date }) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasMore = allItems.length > PAGE_SIZE;
  const items = allItems.slice(0, PAGE_SIZE);

  return { items, hasMore };
}
