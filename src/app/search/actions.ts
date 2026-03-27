"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchLimiter, isRateLimited } from "@/lib/rate-limit";
import { PAGE_SIZE } from "@/app/feed/feed-queries";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { normalizeTag } from "@/lib/tags";
import { getUserPrefs } from "@/lib/user-prefs";
import { cached, cacheKeys } from "@/lib/cache";

export async function searchUsers(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { users: [], hasMore: false };

  if (await isRateLimited(searchLimiter, `search:${session.user.id}`)) {
    return { users: [], hasMore: false };
  }

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { users: [], hasMore: false };

  const cacheKey = cacheKeys.userSearch(session.user.id, `${trimmed.toLowerCase()}:${cursor || ""}`);

  return cached(cacheKey, async () => {
    const blockedIds = await getAllBlockRelatedIds(session.user.id);
    const fetchCount = PAGE_SIZE + 1;

    const users = await prisma.user.findMany({
      where: {
        ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
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
        profileFrameId: true,
        image: true,
        usernameFont: true,
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
  }, 120);
}

export async function searchPosts(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { posts: [], hasMore: false };

  if (await isRateLimited(searchLimiter, `search:${session.user.id}`)) {
    return { posts: [], hasMore: false };
  }

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { posts: [], hasMore: false };

  const cacheKey = cacheKeys.postSearch(session.user.id, `${trimmed.toLowerCase()}:${cursor || ""}`);

  return cached(cacheKey, async () => {
    const [prefs, blockedIds] = await Promise.all([
      getUserPrefs(session.user.id),
      getAllBlockRelatedIds(session.user.id),
    ]);

    // Build content flag filters based on user verification/preferences
    const contentFilters: Record<string, boolean>[] = [];
    if (!prefs.ageVerified) {
      contentFilters.push({ isGraphicNudity: false });
      contentFilters.push({ isSensitive: false });
    }
    if (!prefs.showNsfwContent) {
      contentFilters.push({ isNsfw: false });
    }

    const fetchCount = PAGE_SIZE + 1;

    const posts = await prisma.post.findMany({
      where: {
        content: { contains: trimmed, mode: "insensitive" },
        marketplacePost: null,
        ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        ...(contentFilters.length > 0 ? { AND: contentFilters } : {}),
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
            profileFrameId: true,
            image: true,
            usernameFont: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: { name: true },
            },
          },
        },
      },
    });

    const hasMore = posts.length > PAGE_SIZE;
    return {
      posts: posts.slice(0, PAGE_SIZE),
      hasMore,
    };
  }, 120);
}

export async function searchTagsForSearch(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { tags: [], hasMore: false };

  if (await isRateLimited(searchLimiter, `search:${session.user.id}`)) {
    return { tags: [], hasMore: false };
  }

  const normalized = normalizeTag(query);
  if (!normalized) return { tags: [], hasMore: false };

  const cacheKey = cacheKeys.tagSearchForSearch(session.user.id, `${normalized}:${cursor || ""}`);

  return cached(cacheKey, async () => {
    const prefs = await getUserPrefs(session.user.id);
    const includeNsfw = prefs.showNsfwContent;
    const postFilter = includeNsfw
      ? { isSensitive: false, isGraphicNudity: false, author: { isProfilePublic: true }, marketplacePost: null as null }
      : { isSensitive: false, isNsfw: false, isGraphicNudity: false, author: { isProfilePublic: true }, marketplacePost: null as null };

    const fetchCount = PAGE_SIZE + 1;

    const tags = await prisma.tag.findMany({
      where: {
        name: { contains: normalized, mode: "insensitive" },
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
        isNsfw: true,
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
      take: fetchCount,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = tags.length > PAGE_SIZE;
    return {
      tags: tags.slice(0, PAGE_SIZE).map((t: typeof tags[number]) => ({
        id: t.id,
        name: t.name,
        isNsfw: t.isNsfw,
        postCount: t._count.posts,
      })),
      hasMore,
    };
  }, 120);
}

export async function searchMarketplacePosts(query: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) return { posts: [], hasMore: false };

  if (await isRateLimited(searchLimiter, `search:${session.user.id}`)) {
    return { posts: [], hasMore: false };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ageVerified: true, showNsfwContent: true },
  });

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { posts: [], hasMore: false };

  const blockedIds = await getAllBlockRelatedIds(session.user.id);

  const contentFilters: Record<string, boolean>[] = [];
  if (!currentUser?.ageVerified) {
    contentFilters.push({ isGraphicNudity: false });
    contentFilters.push({ isSensitive: false });
  }
  if (!currentUser?.showNsfwContent) {
    contentFilters.push({ isNsfw: false });
  }

  const fetchCount = PAGE_SIZE + 1;

  const posts = await prisma.post.findMany({
    where: {
      content: { contains: trimmed, mode: "insensitive" },
      marketplacePost: { isNot: null },
      ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      ...(contentFilters.length > 0 ? { AND: contentFilters } : {}),
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
          profileFrameId: true,
          image: true,
          usernameFont: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          reposts: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: { name: true },
          },
        },
      },
      marketplacePost: {
        select: {
          id: true,
          price: true,
          purchaseUrl: true,
          shippingOption: true,
          shippingPrice: true,
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
