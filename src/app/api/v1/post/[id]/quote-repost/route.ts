/**
 * Quote-repost a post from mobile.
 *
 *   POST /api/v1/post/:id/quote-repost   body: { content: string }
 *     → { ok, repostId, reposts }
 *
 * Mirrors the web's `createQuoteRepost` action
 * (`src/app/feed/post-actions.ts:259`), but scoped to mobile's
 * constraints:
 *   - Can't quote-repost your own post. (Same as web.)
 *   - Refuses if the viewer has already straight-reposted this post —
 *     quoting after a repost gets confusing on feeds.
 *   - Forces `isNsfw` / `isSensitive` / `isGraphicNudity` = false
 *     regardless of what the client sends. Play-policy.
 *   - Same gates as mobile post create: not suspended, phone verified,
 *     18+.
 *
 * Response carries the updated straight-repost count too so the
 * client can reconcile the row's counter alongside the Reposted flag.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { createNotification } from "@/lib/notifications";

const MAX_QUOTE_LENGTH = 5000;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const viewerId = viewer.userId;
  const { id } = await params;

  if (!(await requireNotSuspended(viewerId))) {
    return NextResponse.json(
      { error: "Account suspended" },
      { status: 403, headers: corsHeaders(req) },
    );
  }
  if (!(await requirePhoneVerification(viewerId))) {
    return NextResponse.json(
      { error: "Phone verification required to post" },
      { status: 403, headers: corsHeaders(req) },
    );
  }
  if (!(await requireMinimumAge(viewerId, 18))) {
    return NextResponse.json(
      { error: "You must be 18 or older to post" },
      { status: 403, headers: corsHeaders(req) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders(req) },
    );
  }
  const rawContent =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).content
      : undefined;
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "Quote text can't be empty" },
      { status: 400, headers: corsHeaders(req) },
    );
  }
  if (content.length > MAX_QUOTE_LENGTH) {
    return NextResponse.json(
      { error: "Quote is too long" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!post) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }
  if (post.authorId === viewerId) {
    return NextResponse.json(
      { error: "You can't quote-repost your own post" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  // Refuse double-repost: if the viewer already has a straight repost,
  // point them at that instead of piling on a quote.
  const existingStraight = await prisma.repost.findFirst({
    where: { postId: id, userId: viewerId, quotedRepostId: null },
    select: { id: true },
  });
  if (existingStraight) {
    return NextResponse.json(
      { error: "You have already reposted this post" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const repost = await prisma.repost.create({
    data: {
      postId: id,
      userId: viewerId,
      content,
      isNsfw: false,
      isSensitive: false,
      isGraphicNudity: false,
      isCloseFriendsOnly: false,
    },
    select: { id: true },
  });

  // Bump stars (same tick as straight reposts / new posts) and notify
  // the author.
  await prisma.user.update({
    where: { id: viewerId },
    data: { stars: { increment: 1 } },
  });
  if (post.authorId && post.authorId !== viewerId) {
    try {
      await createNotification({
        type: "REPOST",
        actorId: viewerId,
        targetUserId: post.authorId,
        postId: id,
        repostId: repost.id,
      });
    } catch (err) {
      console.error("[quote-repost] notify failed:", err);
    }
  }

  const reposts = await prisma.repost.count({
    where: { postId: id, quotedRepostId: null },
  });

  return NextResponse.json(
    { ok: true, repostId: repost.id, reposts },
    { headers: corsHeaders(req) },
  );
}
