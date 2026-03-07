"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTag } from "@/lib/tags";
import { PAGE_SIZE, getPostInclude } from "@/app/feed/feed-queries";
import { cached, cacheKeys } from "@/lib/cache";

/**
 * Search for existing tags matching a query prefix.
 * Only returns tags used on 2+ non-NSFW/non-sensitive posts.
 */
export async function searchTags(query: string) {
  const normalized = normalizeTag(query);
  if (!normalized) return [];

  const tags = await prisma.tag.findMany({
    where: {
      name: { startsWith: normalized },
      posts: {
        some: {
          post: { isSensitive: false, isNsfw: false },
        },
      },
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          posts: {
            where: {
              post: { isSensitive: false, isNsfw: false },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  // Only return tags used on 2+ posts
  return tags
    .filter((t) => t._count.posts >= 2)
    .slice(0, 10)
    .map((t) => ({ id: t.id, name: t.name, count: t._count.posts }));
}

/**
 * Get tag cloud data: tag names with their post counts,
 * excluding NSFW/sensitive posts.
 */
export async function getTagCloudData() {
  return cached(
    cacheKeys.tagCloud(),
    async () => {
      const tags = await prisma.tag.findMany({
        select: {
          name: true,
          _count: {
            select: {
              posts: {
                where: {
                  post: { isSensitive: false, isNsfw: false },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return tags
        .filter((t) => t._count.posts > 0)
        .map((t) => ({ name: t.name, count: t._count.posts }))
        .sort((a, b) => b.count - a.count);
    },
    300 // cache for 5 minutes
  );
}

/**
 * Get posts by tag name with cursor-based pagination.
 * Excludes NSFW/sensitive posts.
 */
export async function getPostsByTag(
  tagName: string,
  userId?: string,
  cursor?: string
) {
  const session = await auth();
  const currentUserId = userId || session?.user?.id || "";

  const normalized = normalizeTag(tagName);
  if (!normalized) return { posts: [], hasMore: false, totalCount: 0 };

  const fetchCount = PAGE_SIZE + 1;

  const totalCount = await cached(
    cacheKeys.tagPostCount(normalized),
    () => prisma.postTag.count({
      where: {
        tag: { name: normalized },
        post: { isSensitive: false, isNsfw: false },
      },
    }),
    120 // cache for 2 minutes
  );

  const postTags = await prisma.postTag.findMany({
    where: {
      tag: { name: normalized },
      post: { isSensitive: false, isNsfw: false },
    },
    orderBy: { post: { createdAt: "desc" } },
    take: fetchCount,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    include: {
      post: {
        include: getPostInclude(currentUserId),
      },
    },
  });

  const hasMore = postTags.length > PAGE_SIZE;
  const items = postTags.slice(0, PAGE_SIZE);

  return {
    posts: items.map((pt) => ({
      ...pt.post,
      postTagId: pt.id,
    })),
    hasMore,
    totalCount,
  };
}
