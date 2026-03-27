"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const isLoggedIn = !!session?.user?.id;

  let showNsfwContent = false;
  let ageVerified = false;

  if (session?.user?.id) {
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showNsfwContent: true, ageVerified: true },
    });
    showNsfwContent = currentUser?.showNsfwContent ?? false;
    ageVerified = !!currentUser?.ageVerified;
  }

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  const fetchCount = MARKETPLACE_PAGE_SIZE + 1;

  // Logged-out: only public profiles OR posts with publicListing enabled
  // Logged-in: all marketplace posts
  const visibilityFilter = isLoggedIn
    ? {}
    : {
        OR: [
          { author: { isProfilePublic: true } },
          { marketplacePost: { publicListing: true } },
        ],
      };

  const posts = await prisma.post.findMany({
    where: {
      marketplacePost: { isNot: null },
      ...visibilityFilter,
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

  const resultPosts: MarketplaceMediaPost[] = posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    isNsfw: post.isNsfw,
    isGraphicNudity: post.isGraphicNudity,
    author: post.author,
    marketplacePost: post.marketplacePost,
  }));

  const hasMore = resultPosts.length > MARKETPLACE_PAGE_SIZE;
  return {
    posts: resultPosts.slice(0, MARKETPLACE_PAGE_SIZE),
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
