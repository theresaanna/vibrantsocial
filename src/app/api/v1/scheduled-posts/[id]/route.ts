/**
 * Cancel a not-yet-published scheduled post.
 *
 *   DELETE /api/v1/scheduled-posts/:id  → { ok: true }
 *
 * Must be the author's own post and `scheduledFor` must still be in the
 * future. Deletes the Post row outright — same semantics as the web
 * `deleteScheduledPost()` action (`src/app/compose/schedule-actions.ts`).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true, scheduledFor: true },
  });
  if (!post || post.authorId !== viewer.userId) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }
  if (!post.scheduledFor || post.scheduledFor <= new Date()) {
    return NextResponse.json(
      { error: "Post is already published" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  await prisma.post.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
}
