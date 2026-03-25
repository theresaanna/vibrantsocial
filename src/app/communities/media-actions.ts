"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";

const MEDIA_PAGE_SIZE = 30;

export interface CommunitiesMediaPost {
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
  } | null;
}

/**
 * Fetch recent media posts from all public users for the communities page.
 * Respects NSFW toggle but always excludes sensitive and graphic/explicit content.
 */
export async function fetchCommunitiesMediaPage(
  cursor?: string
): Promise<{ posts: CommunitiesMediaPost[]; hasMore: boolean }> {
  const session = await auth();

  let showNsfwContent = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showNsfwContent: true },
    });
    showNsfwContent = user?.showNsfwContent ?? false;
  }

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  // Fetch more posts than needed since many won't have media
  const fetchCount = MEDIA_PAGE_SIZE * 3;

  const isLoggedIn = !!session?.user?.id;

  const posts = await prisma.post.findMany({
    where: {
      ...(isLoggedIn ? {} : { author: { isProfilePublic: true } }),
      marketplacePost: null,
      isSensitive: false,
      isGraphicNudity: false,
      ...(!showNsfwContent
        ? {
            isNsfw: false,
            // Also exclude posts that have any NSFW tag
            NOT: {
              tags: { some: { tag: { isNsfw: true } } },
            },
          }
        : {}),
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
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
        },
      },
    },
  });

  // Filter to posts that contain media
  const mediaPosts: CommunitiesMediaPost[] = [];
  for (const post of posts) {
    const media = extractMediaFromLexicalJson(post.content);
    if (media.length > 0) {
      mediaPosts.push({
        id: post.id,
        slug: post.slug,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        author: post.author,
      });
    }
    if (mediaPosts.length >= MEDIA_PAGE_SIZE + 1) break;
  }

  const hasMore = mediaPosts.length > MEDIA_PAGE_SIZE;
  return {
    posts: mediaPosts.slice(0, MEDIA_PAGE_SIZE),
    hasMore,
  };
}
