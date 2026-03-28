"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getPostInclude } from "@/app/feed/feed-queries";

const TOP_DISCUSSED_LIMIT = 5;
const DAYS_WINDOW = 7;

/**
 * Fetch the top 5 most-commented public posts from the past 7 days.
 * Eagerly loads full comment trees for inline display.
 * Respects NSFW toggle and always excludes sensitive/graphic content.
 */
export async function fetchTopDiscussedPosts() {
  const session = await auth();
  const userId = session?.user?.id;

  let showNsfwContent = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let phoneVerified = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        showNsfwContent: true,
        ageVerified: true,
        showGraphicByDefault: true,
        phoneVerified: true,
      },
    });
    showNsfwContent = user?.showNsfwContent ?? false;
    ageVerified = user?.ageVerified ?? false;
    showGraphicByDefault = user?.showGraphicByDefault ?? false;
    phoneVerified = user?.phoneVerified ?? false;
  }

  const since = new Date();
  since.setDate(since.getDate() - DAYS_WINDOW);

  const blockedIds = userId ? await getAllBlockRelatedIds(userId) : [];

  const posts = await prisma.post.findMany({
    where: {
      createdAt: { gte: since },
      author: {
        isProfilePublic: true,
        ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
      },
      isSensitive: false,
      isGraphicNudity: false,
      ...(!showNsfwContent
        ? {
            isNsfw: false,
            NOT: {
              tags: { some: { tag: { isNsfw: true } } },
            },
          }
        : {}),
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      comments: { some: {} }, // must have at least one comment
    },
    orderBy: {
      comments: { _count: "desc" },
    },
    take: TOP_DISCUSSED_LIMIT,
    include: {
      ...(userId ? getPostInclude(userId) : getPostInclude("")),
      comments: {
        ...(blockedIds.length > 0
          ? { where: { authorId: { notIn: blockedIds } } }
          : {}),
        orderBy: { createdAt: "asc" as const },
        include: {
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
          reactions: { select: { emoji: true, userId: true } },
        },
      },
    },
  });

  // Build comment trees and group reactions (same logic as fetchComments)
  const serialized = posts.map((post) => {
    const tree = buildCommentTree(post.comments);
    return {
      ...post,
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt?.toISOString() ?? null,
      comments: tree,
    };
  });

  return JSON.parse(JSON.stringify({
    posts: serialized,
    currentUserId: userId ?? null,
    phoneVerified,
    ageVerified,
    showGraphicByDefault,
    showNsfwContent,
  }));
}

// --- Comment tree utilities (mirrors post-actions.ts) ---

function groupReactions(
  reactions: { emoji: string; userId: string }[]
): { emoji: string; userIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji) ?? [];
    list.push(r.userId);
    map.set(r.emoji, list);
  }
  return Array.from(map, ([emoji, userIds]) => ({ emoji, userIds }));
}

type RawComment = {
  id: string;
  parentId: string | null;
  reactions: { emoji: string; userId: string }[];
  [key: string]: unknown;
};

function buildCommentTree(comments: RawComment[]) {
  const map = new Map<string, Record<string, unknown>>();
  const roots: Record<string, unknown>[] = [];

  for (const c of comments) {
    map.set(c.id, {
      ...c,
      reactions: groupReactions(c.reactions),
      replies: [],
    });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      (map.get(c.parentId)!.replies as Record<string, unknown>[]).push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
