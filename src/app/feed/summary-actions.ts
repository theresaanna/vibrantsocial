"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";

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

  const [closeFriendOfRows, currentUser] = await Promise.all([
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { showNsfwContent: true, ageVerified: true },
    }),
  ]);

  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;
  const closeFriendAuthors = [
    ...closeFriendOfRows.map((r: { userId: string }) => r.userId),
    userId,
  ];

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

function buildPostsText(posts: SummaryPost[]): string {
  let totalChars = 0;
  const lines: string[] = [];

  for (const post of posts) {
    const name =
      post.author?.displayName || post.author?.username || "Someone";
    let text = extractTextFromLexicalJson(post.content);
    if (!text) text = "(media post)";
    if (text.length > 200) text = text.slice(0, 200) + "...";

    const line = `@${name}: ${text} (${post._count.likes} likes, ${post._count.comments} comments, ${post._count.reposts} reposts)`;

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

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
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

  const since = new Date(lastSeenFeedAt);

  try {
    const posts = await fetchMissedPosts(
      session.user.id,
      since,
      SUMMARY_POST_LIMIT + 1
    );

    if (posts.length === 0) {
      return { summary: null, missedCount: 0, tooMany: false };
    }

    // Always return the count and let the user choose to generate
    return { summary: null, missedCount: posts.length, tooMany: posts.length > SUMMARY_POST_LIMIT };
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
    const posts = await fetchMissedPosts(
      session.user.id,
      new Date(lastSeenFeedAt),
      SUMMARY_POST_LIMIT
    );

    if (posts.length === 0) return null;

    return await generateSummary(posts, posts.length);
  } catch (error) {
    console.error("Feed summary on-demand error:", error);
    return null;
  }
}
