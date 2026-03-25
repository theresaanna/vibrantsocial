"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";

const MARKETPLACE_PAGE_SIZE = 30;

export interface MarketplaceMediaPost {
  id: string;
  slug: string | null;
  content: string;
  createdAt: string;
  isNsfw: boolean;
  isGraphicNudity: boolean;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    image: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  } | null;
  marketplacePost: {
    id: string;
    price: number;
    purchaseUrl: string;
    shippingOption: string;
    shippingPrice: number | null;
  } | null;
}

export async function fetchMarketplacePage(
  cursor?: string
): Promise<{ posts: MarketplaceMediaPost[]; hasMore: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { posts: [], hasMore: false };
  }

  const userId = session.user.id;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { showNsfwContent: true, ageVerified: true },
  });

  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  const fetchCount = MARKETPLACE_PAGE_SIZE * 3;

  const posts = await prisma.post.findMany({
    where: {
      marketplacePost: { isNot: null },
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified ? { isGraphicNudity: false } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    select: {
      id: true,
      slug: true,
      content: true,
      createdAt: true,
      isNsfw: true,
      isGraphicNudity: true,
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

  // Filter to posts that contain media for the grid view
  const mediaPosts: MarketplaceMediaPost[] = [];
  for (const post of posts) {
    const media = extractMediaFromLexicalJson(post.content);
    if (media.length > 0) {
      mediaPosts.push({
        id: post.id,
        slug: post.slug,
        content: post.content,
        createdAt: post.createdAt.toISOString(),
        isNsfw: post.isNsfw,
        isGraphicNudity: post.isGraphicNudity,
        author: post.author,
        marketplacePost: post.marketplacePost,
      });
    }
    if (mediaPosts.length >= MARKETPLACE_PAGE_SIZE + 1) break;
  }

  const hasMore = mediaPosts.length > MARKETPLACE_PAGE_SIZE;
  return {
    posts: mediaPosts.slice(0, MARKETPLACE_PAGE_SIZE),
    hasMore,
  };
}

export async function fetchUserMarketplacePosts(
  userId: string,
  cursor?: string
): Promise<{ posts: MarketplaceMediaPost[]; hasMore: boolean }> {
  const session = await auth();
  const currentUserId = session?.user?.id;

  let showNsfwContent = false;
  let ageVerified = false;

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { showNsfwContent: true, ageVerified: true },
    });
    showNsfwContent = currentUser?.showNsfwContent ?? false;
    ageVerified = !!currentUser?.ageVerified;
  }

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  const posts = await prisma.post.findMany({
    where: {
      authorId: userId,
      marketplacePost: { isNot: null },
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified ? { isGraphicNudity: false } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MARKETPLACE_PAGE_SIZE + 1,
    select: {
      id: true,
      slug: true,
      content: true,
      createdAt: true,
      isNsfw: true,
      isGraphicNudity: true,
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

  const hasMore = posts.length > MARKETPLACE_PAGE_SIZE;
  const result = posts.slice(0, MARKETPLACE_PAGE_SIZE);

  return {
    posts: result.map((post) => ({
      id: post.id,
      slug: post.slug,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      isNsfw: post.isNsfw,
      isGraphicNudity: post.isGraphicNudity,
      author: post.author,
      marketplacePost: post.marketplacePost,
    })),
    hasMore,
  };
}
