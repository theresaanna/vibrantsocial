"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited, apiLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const VIEW_SOURCE = ["feed", "direct", "profile", "search", "tag", "external"] as const;
export type ViewSource = (typeof VIEW_SOURCE)[number];

const RecordViewSchema = z.object({
  postId: z.string().min(1),
  source: z.enum(VIEW_SOURCE),
  referrer: z.string().nullable().optional(),
});

/**
 * Record that a post was viewed. Fire-and-forget — never throws.
 * Skips self-views and respects rate limiting.
 */
export async function recordPostView(input: {
  postId: string;
  source: string;
  referrer?: string | null;
}): Promise<void> {
  try {
    const parsed = RecordViewSchema.safeParse(input);
    if (!parsed.success) return;

    const session = await auth();
    const userId = session?.user?.id ?? null;

    const limiterKey = `view:${userId ?? "anon"}`;
    if (await isRateLimited(apiLimiter, limiterKey)) return;

    // Don't record self-views
    if (userId) {
      const post = await prisma.post.findUnique({
        where: { id: parsed.data.postId },
        select: { authorId: true },
      });
      if (!post || post.authorId === userId) return;
    }

    await prisma.postView.create({
      data: {
        postId: parsed.data.postId,
        userId,
        source: parsed.data.source,
        referrer: parsed.data.referrer ?? null,
      },
    });
  } catch {
    // Analytics must never break the user experience
  }
}
