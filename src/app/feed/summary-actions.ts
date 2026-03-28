"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { cached, getCached, cacheKeys, invalidate } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getUserPrefs } from "@/lib/user-prefs";
import { getCachedCloseFriendOfIds } from "@/app/feed/close-friends-actions";

const SUMMARY_POST_LIMIT = 50;
const MAX_CONTENT_CHARS = 4000;

export interface FeedSummaryResult {
  summary: string | null;
  missedCount: number;
  tooMany: boolean;
}

interface SummaryPost {
  content: string;
  author: { displayName: string | null; username: string | null } | null;
  _count: { likes: number; comments: number; reposts: number };
  createdAt: Date;
}

async function fetchMissedPosts(userId: string, since: Date, limit: number) {
  const [allFollowingIds, blockedIds] = await Promise.all([
    cached(
      cacheKeys.userFollowing(userId),
      async () => {
        const rows = await prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        return rows.map((f: { followingId: string }) => f.followingId);
      },
      60
    ),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const followingIds = allFollowingIds.filter(
    (id: string) => !blockedSet.has(id)
  );

  if (followingIds.length === 0) return [];

  const [prefs, closeFriendOfIds] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);

  const { showNsfwContent, ageVerified } = prefs;
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  return prisma.post.findMany({
    where: {
      authorId: { in: [...followingIds, userId] },
      createdAt: { gt: since },
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
      OR: [
        { isCloseFriendsOnly: false, hasCustomAudience: false },
        { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
        { hasCustomAudience: true, audience: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      content: true,
      author: {
        select: { displayName: true, username: true },
      },
      _count: {
        select: { likes: true, comments: true, reposts: true },
      },
      createdAt: true,
    },
  });
}

/** Strip lone surrogates that would produce invalid JSON. */
function sanitizeText(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

function buildPostsText(posts: SummaryPost[]): string {
  let totalChars = 0;
  const lines: string[] = [];

  for (const post of posts) {
    const name =
      post.author?.displayName || post.author?.username || "Someone";
    let text = extractTextFromLexicalJson(post.content);
    if (!text) text = "(media post)";
    if (text.length > 200) text = [...text].slice(0, 200).join("") + "...";

    const line = `@${sanitizeText(name)}: ${sanitizeText(text)} (${post._count.likes} likes, ${post._count.comments} comments, ${post._count.reposts} reposts)`;

    if (totalChars + line.length > MAX_CONTENT_CHARS) break;
    lines.push(line);
    totalChars += line.length;
  }

  return lines.join("\n");
}

async function generateSummary(
  posts: SummaryPost[],
  count: number
): Promise<string> {
  const postsText = buildPostsText(posts);

  console.log("[FeedSummary] Calling Anthropic API with", count, "posts,", postsText.length, "chars");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system:
      "You are a friendly social media assistant. Summarize what happened in a user's feed while they were away. Be brief, warm, and highlight the most interesting or popular posts. 2-4 sentences max.",
    messages: [
      {
        role: "user",
        content: `Here are ${count} posts from my feed since I was last online:\n\n${postsText}\n\nGive me a quick, friendly summary of what I missed.`,
      },
    ],
  });

  console.log("[FeedSummary] Anthropic API responded successfully");

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return `You have ${count} new posts in your feed!`;
  }

  return textBlock.text;
}

export async function fetchFeedSummary(
  lastSeenFeedAt: string
): Promise<FeedSummaryResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { summary: null, missedCount: 0, tooMany: false };
  }

  let since = new Date(lastSeenFeedAt);

  try {
    let posts = await fetchMissedPosts(
      session.user.id,
      since,
      SUMMARY_POST_LIMIT + 1
    );

    // If no posts since last seen, fall back to the last 24 hours
    if (posts.length === 0) {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      posts = await fetchMissedPosts(
        session.user.id,
        since,
        SUMMARY_POST_LIMIT + 1
      );
    }

    if (posts.length === 0) {
      return { summary: null, missedCount: 0, tooMany: false };
    }

    // Return the cached summary if available, otherwise let the user generate on demand
    const cachedSummary = await getCached<string>(
      cacheKeys.feedSummary(session.user.id)
    );

    return {
      summary: cachedSummary,
      missedCount: posts.length,
      tooMany: posts.length > SUMMARY_POST_LIMIT,
    };
  } catch (error) {
    console.error("Feed summary error:", error);
    return { summary: null, missedCount: 0, tooMany: false };
  }
}

export async function generateFeedSummaryOnDemand(
  lastSeenFeedAt: string
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    return await cached(
      cacheKeys.feedSummary(session.user.id),
      async () => {
        let posts = await fetchMissedPosts(
          session.user.id!,
          new Date(lastSeenFeedAt),
          SUMMARY_POST_LIMIT
        );

        // Fall back to last 24 hours if no posts since last seen
        if (posts.length === 0) {
          posts = await fetchMissedPosts(
            session.user.id!,
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            SUMMARY_POST_LIMIT
          );
        }

        if (posts.length === 0) return null;

        return await generateSummary(posts, posts.length);
      },
      // Cache indefinitely (24h TTL as safety net); invalidated when new posts are created
      86400
    );
  } catch (error) {
    console.error("[FeedSummary] on-demand error:", error);
    if (error instanceof Error) {
      console.error("[FeedSummary] error name:", error.name);
      console.error("[FeedSummary] error message:", error.message);
    }
    // Return a friendly fallback instead of null so the banner doesn't reset
    return "Your friends have been posting! Scroll down to see what's new.";
  }
}

export async function invalidateFeedSummary(userId: string) {
  await invalidate(cacheKeys.feedSummary(userId));
}
