/**
 * List the viewer's future-scheduled posts.
 *
 *   GET /api/v1/scheduled-posts
 *     → { posts: [{ id, scheduledFor, text, tagNames }] }
 *
 * Only posts still in the future (not yet picked up by the Inngest
 * publisher) are returned. Sorted ascending so the next-to-publish is
 * on top.
 *
 * `text` is a plain-text preview derived from the stored Lexical JSON —
 * the mobile management screen only needs enough to identify the
 * post, not a full renderer.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const rows = await prisma.post.findMany({
    where: {
      authorId: viewer.userId,
      scheduledFor: { not: null, gt: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    select: {
      id: true,
      content: true,
      scheduledFor: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  return NextResponse.json(
    {
      posts: rows.map((r) => ({
        id: r.id,
        scheduledFor: r.scheduledFor!.toISOString(),
        text: (extractTextFromLexicalJson(r.content) || '').trim(),
        tagNames: r.tags.map((t) => t.tag.name),
      })),
    },
    { headers: corsHeaders(req) },
  );
}
