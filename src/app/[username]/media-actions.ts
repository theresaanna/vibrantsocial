"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";
import { getUserPrefs } from "@/lib/user-prefs";
import { publishedOnly } from "@/app/feed/feed-queries";

const MEDIA_PAGE_SIZE = 30;

interface ProfileMediaPost {
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
 * Fetch posts with media (images, videos, YouTube embeds) from a specific user.
 * Respects visibility rules: close friends, custom audience, content flags.
 */
export async function fetchUserMediaPosts(
  userId: string,
  cursor?: string
): Promise<{ posts: ProfileMediaPost[]; hasMore: boolean }> {
  const session = await auth();
  const currentUserId = session?.user?.id;

  const isOwnProfile = currentUserId === userId;

  // Build visibility filters
  let closeFriendsFilter = {};
  if (!isOwnProfile && currentUserId) {
    const closeFriendEntry = await prisma.closeFriend.findUnique({
      where: { userId_friendId: { userId, friendId: currentUserId } },
    });
    if (!closeFriendEntry) {
      closeFriendsFilter = { isCloseFriendsOnly: false };
    }
  } else if (!currentUserId) {
    closeFriendsFilter = { isCloseFriendsOnly: false };
  }

  const audienceFilter = isOwnProfile
    ? {}
    : currentUserId
      ? {
          OR: [
            { hasCustomAudience: false },
            { hasCustomAudience: true, audience: { some: { userId: currentUserId } } },
          ],
        }
      : { hasCustomAudience: false };

  // Content flag filters — hide sensitive/graphic from media tab unless
  // the user has explicitly opted to remove the overlay for that category
  let nsfwFilter = {};
  if (!currentUserId) {
    nsfwFilter = { isSensitive: false, isNsfw: false, isGraphicNudity: false, isLoggedInOnly: false };
  } else {
    const prefs = await getUserPrefs(currentUserId);
    nsfwFilter = {
      ...(!prefs.showNsfwContent ? { isNsfw: false } : {}),
      ...(!prefs.showNsfwContent || !prefs.ageVerified || !prefs.hideSensitiveOverlay ? { isSensitive: false } : {}),
      ...(!prefs.showNsfwContent || !prefs.ageVerified || !prefs.showGraphicByDefault ? { isGraphicNudity: false } : {}),
    };
  }

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;

  // Fetch more posts than needed since many won't have media
  const fetchCount = MEDIA_PAGE_SIZE * 3;

  const posts = await prisma.post.findMany({
    where: {
      ...publishedOnly,
      authorId: userId,
      ...nsfwFilter,
      ...closeFriendsFilter,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      AND: [
        // Audience visibility
        audienceFilter,
        // Exclude marketplace posts unless promoted
        {
          OR: [
            { marketplacePost: null },
            { marketplacePost: { promotedToFeed: true } },
          ],
        },
      ],
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
          usernameFont: true,
        },
      },
    },
  });

  // Filter to posts that contain media
  const mediaPosts: ProfileMediaPost[] = [];
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
