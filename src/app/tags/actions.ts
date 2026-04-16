"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";
import { normalizeTag } from "@/lib/tags";
import { PAGE_SIZE, getPostInclude } from "@/app/feed/feed-queries";
import { cached, cacheKeys, invalidate } from "@/lib/cache";
import { isAdmin } from "@/lib/admin";

interface TagCloudEntry {
  name: string;
  count: number;
}

interface TagWithCount {
  name: string;
  _count: { posts: number };
}

function toSortedTagCloud(tags: TagWithCount[]): TagCloudEntry[] {
  return tags
    .filter((t) => t._count.posts > 0)
    .map((t) => ({ name: t.name, count: t._count.posts }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Search for existing tags matching a query prefix.
 * When includeNsfw is true, also searches tags used on NSFW posts.
 * Only counts posts from users with public profiles.
 */
export async function searchTags(query: string, includeNsfw?: boolean) {
  const normalized = normalizeTag(query);
  if (!normalized) return [];

  const cacheKey = cacheKeys.tagSearch(normalized, !!includeNsfw);

  return cached(cacheKey, async () => {
    const postFilter = includeNsfw
      ? { isSensitive: false, isGraphicNudity: false, author: { isProfilePublic: true }, marketplacePost: null as null }
      : { isSensitive: false, isNsfw: false, isGraphicNudity: false, author: { isProfilePublic: true }, marketplacePost: null as null };

    const tags = await prisma.tag.findMany({
      where: {
        name: { startsWith: normalized },
        ...(!includeNsfw ? { isNsfw: false } : {}),
        posts: {
          some: {
            post: postFilter,
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
                post: postFilter,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 20,
    });

    // Only return tags used on 2+ posts
    return (tags as (TagWithCount & { id: string })[])
      .filter((t) => t._count.posts >= 2)
      .slice(0, 10)
      .map((t) => ({ id: t.id, name: t.name, count: t._count.posts }));
  }, 180);
}

/**
 * Get tag cloud data: tag names with their post counts,
 * excluding NSFW/sensitive/graphic posts and posts from private profiles.
 */
export async function getTagCloudData() {
  return cached(
    cacheKeys.tagCloud(),
    async () => {
      const tags = await prisma.tag.findMany({
        where: { isNsfw: false },
        select: {
          name: true,
          _count: {
            select: {
              posts: {
                where: {
                  post: {
                    isSensitive: false,
                    isNsfw: false,
                    isGraphicNudity: false,
                    author: { isProfilePublic: true },
                    marketplacePost: null,
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return toSortedTagCloud(tags as TagWithCount[]);
    },
    300 // cache for 5 minutes
  );
}

/**
 * Get NSFW tag cloud data: tags marked NSFW or with NSFW posts.
 * Only for opted-in users. Only counts posts from public profiles.
 */
export async function getNsfwTagCloudData() {
  return cached(
    cacheKeys.nsfwTagCloud(),
    async () => {
      const tags = await prisma.tag.findMany({
        where: {
          OR: [
            { isNsfw: true },
            {
              posts: {
                some: {
                  post: {
                    isNsfw: true,
                    isSensitive: false,
                    isGraphicNudity: false,
                    author: { isProfilePublic: true },
                    marketplacePost: null,
                  },
                },
              },
            },
          ],
        },
        select: {
          name: true,
          _count: {
            select: {
              posts: {
                where: {
                  post: {
                    isSensitive: false,
                    isGraphicNudity: false,
                    author: { isProfilePublic: true },
                    marketplacePost: null,
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return toSortedTagCloud(tags as TagWithCount[]);
    },
    300 // cache for 5 minutes
  );
}

/**
 * Get all tag cloud data (SFW + NSFW combined) for users who opted into NSFW.
 * Excludes sensitive/graphic posts. Only counts posts from public profiles.
 */
export async function getAllTagCloudData() {
  return cached(
    cacheKeys.allTagCloud(),
    async () => {
      const tags = await prisma.tag.findMany({
        select: {
          name: true,
          _count: {
            select: {
              posts: {
                where: {
                  post: {
                    isSensitive: false,
                    isGraphicNudity: false,
                    author: { isProfilePublic: true },
                    marketplacePost: null,
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return toSortedTagCloud(tags as TagWithCount[]);
    },
    300 // cache for 5 minutes
  );
}

/**
 * Get posts by tag name with cursor-based pagination.
 * When includeNsfw is true, also includes NSFW posts.
 * Only returns posts from users with public profiles.
 */
export async function getPostsByTag(
  tagName: string,
  userId?: string,
  cursor?: string,
  includeNsfw?: boolean
) {
  const session = await auth();
  const currentUserId = userId || session?.user?.id || "";
  const isLoggedIn = !!currentUserId;

  const normalized = normalizeTag(tagName);
  if (!normalized) return { posts: [], hasMore: false, totalCount: 0 };

  const authorFilter = isLoggedIn ? {} : { author: { isProfilePublic: true } };
  const postFilter = includeNsfw
    ? { isSensitive: false, isGraphicNudity: false, ...authorFilter, marketplacePost: null }
    : { isSensitive: false, isNsfw: false, isGraphicNudity: false, ...authorFilter, marketplacePost: null };

  const fetchCount = PAGE_SIZE + 1;

  const totalCount = await cached(
    cacheKeys.tagPostCount(normalized),
    () => prisma.postTag.count({
      where: {
        tag: { name: normalized },
        post: postFilter,
      },
    }),
    120 // cache for 2 minutes
  );

  const postTags = await prisma.postTag.findMany({
    where: {
      tag: { name: normalized },
      post: postFilter,
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
    posts: items.map((pt: { id: string; post: Record<string, unknown> }) => ({
      ...pt.post,
      postTagId: pt.id,
    })),
    hasMore,
    totalCount,
  };
}

const MEDIA_PAGE_SIZE = 30;

interface MediaPost {
  id: string;
  slug: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
    avatar: string | null;
    profileFrameId: string | null;
    usernameFont: string | null;
  } | null;
}

/**
 * Fetch media posts for a specific tag (images, videos, YouTube embeds).
 */
export async function fetchMediaByTag(
  tagName: string,
  includeNsfw?: boolean,
  cursor?: string
): Promise<{ posts: MediaPost[]; hasMore: boolean }> {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;

  const normalized = normalizeTag(tagName);
  if (!normalized) return { posts: [], hasMore: false };

  const authorFilter = isLoggedIn ? {} : { author: { isProfilePublic: true } };
  const nsfwFilter = includeNsfw
    ? { isSensitive: false, isGraphicNudity: false }
    : { isSensitive: false, isNsfw: false, isGraphicNudity: false };

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  const posts = await prisma.post.findMany({
    where: {
      ...nsfwFilter,
      ...authorFilter,
      marketplacePost: null,
      tags: { some: { tag: { name: normalized } } },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      OR: [
        { content: { contains: '"type":"image"' } },
        { content: { contains: '"type":"video"' } },
        { content: { contains: '"type":"youtube"' } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MEDIA_PAGE_SIZE + 1,
    select: {
      id: true,
      slug: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
          profileFrameId: true,
          usernameFont: true,
        },
      },
    },
  });

  const hasMore = posts.length > MEDIA_PAGE_SIZE;
  const mediaPosts: MediaPost[] = posts.slice(0, MEDIA_PAGE_SIZE).map((post) => ({
    id: post.id,
    slug: post.slug,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
  }));

  return { posts: mediaPosts, hasMore };
}

/**
 * Toggle the isNsfw flag on a tag. Admin only.
 */
export async function toggleTagNsfw(tagId: string) {
  const session = await auth();
  if (!isAdmin(session?.user?.id)) {
    return { success: false, isNsfw: false };
  }

  if (await isRateLimited(apiLimiter, `tag:${session!.user!.id}`)) {
    return { success: false, isNsfw: false };
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) return { success: false, isNsfw: false };

  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: { isNsfw: !tag.isNsfw },
  });

  await invalidate(cacheKeys.tagCloud());
  await invalidate(cacheKeys.nsfwTagCloud());
  await invalidate(cacheKeys.allTagCloud());

  return { success: true, isNsfw: updated.isNsfw };
}
