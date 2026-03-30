"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAblyRestClient } from "@/lib/ably";

/**
 * Cast a vote on a poll embedded in a post. Each user can vote once per post.
 * Publishes a real-time update via Ably so other viewers see the result immediately.
 */
export async function votePoll(postId: string, optionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Ensure post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) throw new Error("Post not found");

  // Create vote (unique constraint prevents double-voting)
  await prisma.pollVote.create({
    data: { postId, optionId, userId },
  });

  // Aggregate current vote counts for this post
  const votes = await getPollVoteCounts(postId);

  // Publish real-time update
  const ably = getAblyRestClient();
  const channel = ably.channels.get(`poll:${postId}`);
  await channel.publish("vote", { votes, voterId: userId });

  return { votes, userVote: optionId };
}

/**
 * Fetch the current poll vote state for a post: aggregate counts per option
 * and the current user's vote (if any).
 */
export async function getPollVotes(postId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  const votes = await getPollVoteCounts(postId);

  let userVote: string | null = null;
  if (userId) {
    const existing = await prisma.pollVote.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { optionId: true },
    });
    userVote = existing?.optionId ?? null;
  }

  return { votes, userVote };
}

/** Returns a map of optionId → vote count for a given post. */
async function getPollVoteCounts(
  postId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.pollVote.groupBy({
    by: ["optionId"],
    where: { postId },
    _count: { id: true },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.optionId] = row._count.id;
  }
  return counts;
}
