/**
 * Wall posts on a user profile.
 *
 *   GET  /api/v1/profile/:username/wall?cursor=<iso>
 *     → { posts: [...], nextCursor, role: { canCompose, canModerate } }
 *
 *   POST /api/v1/profile/:username/wall  body: { content: markdown }
 *     → { ok, postId, wallPostId, status }
 *
 * A wall post is a `Post` with an attached `WallPost` pointer row
 * carrying the `wallOwnerId` + `status` ("pending" | "accepted" |
 * "hidden"). Friends-only create; wall owner can moderate. On mobile
 * we hard-filter every underlying Post through `mobileSafePostFilter`
 * (Play policy).
 *
 * Visibility rules (same as web):
 *   - Wall owner                → pending + accepted (hidden is never served)
 *   - Everyone else (incl. poster) → accepted only
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { withMobileSession } from "@/lib/mobile-session-context";
import { postSelect, serializePost } from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";
import { markdownToLexicalJson } from "@/lib/bio-markdown";
import { areFriends, createNotificationSafe } from "@/lib/action-utils";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { revalidatePath } from "next/cache";

const PAGE_SIZE = 20;
const MIN_CONTENT_LEXICAL_LENGTH = 50; // matches web guard

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }
  const viewerId = session.user.id;

  const { username } = await params;
  const owner = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true, isProfilePublic: true },
  });
  if (!owner) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const isOwner = owner.id === viewerId;
  const isFriend = isOwner ? true : await areFriends(viewerId, owner.id);

  // Status filter — owner sees pending + accepted, everyone else sees
  // accepted only. Hidden never leaves the server regardless.
  const statusFilter = isOwner
    ? { in: ["pending", "accepted"] as const }
    : "accepted";

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const rows = await prisma.wallPost.findMany({
    where: {
      wallOwnerId: owner.id,
      status: typeof statusFilter === "string" ? statusFilter : { in: [...statusFilter.in] },
      post: {
        ...mobileSafePostFilter,
        isAuthorDeleted: false,
        scheduledFor: null,
      },
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      status: true,
      createdAt: true,
      post: { select: postSelect },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const assetBaseUrl = resolveAssetBaseUrl(req);
  const posts = await Promise.all(
    page.map(async (r) => ({
      wallPostId: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      post: await serializePost(r.post, viewerId, assetBaseUrl),
    })),
  );

  return NextResponse.json(
    {
      posts,
      nextCursor: hasMore
        ? page[page.length - 1].createdAt.toISOString()
        : null,
      role: {
        canCompose: !isOwner && isFriend,
        canModerate: isOwner,
      },
    },
    { headers: corsHeaders(req) },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }
  const viewerId = session.user.id;

  // Same set of gates the web action enforces: not suspended, phone-
  // verified, 18+. Wrap the gate calls in `withMobileSession` because
  // they call `auth()` internally and need the bearer-token fallback.
  const gateResult = await withMobileSession(session, async () => {
    if (!(await requireNotSuspended(viewerId))) {
      return { ok: false, code: 403, message: "Your account is suspended" } as const;
    }
    if (!(await requirePhoneVerification(viewerId))) {
      return {
        ok: false,
        code: 403,
        message: "Phone verification required to post",
      } as const;
    }
    if (!(await requireMinimumAge(viewerId, 18))) {
      return {
        ok: false,
        code: 403,
        message: "You must be 18 or older to post",
      } as const;
    }
    return { ok: true } as const;
  });
  if (!gateResult.ok) {
    return NextResponse.json(
      { error: gateResult.message },
      { status: gateResult.code, headers: corsHeaders(req) },
    );
  }

  const { username } = await params;
  const owner = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true },
  });
  if (!owner) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }
  if (owner.id === viewerId) {
    return NextResponse.json(
      { error: "You cannot post on your own wall" },
      { status: 400, headers: corsHeaders(req) },
    );
  }
  if (!(await areFriends(viewerId, owner.id))) {
    return NextResponse.json(
      { error: "Only friends can post on each other's walls" },
      { status: 403, headers: corsHeaders(req) },
    );
  }

  // Body validation — mobile sends a markdown-subset string; server
  // synthesizes Lexical JSON with the same helper we use for bios, so
  // the public profile renders the content rich.
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
  const markdown = typeof rawContent === "string" ? rawContent.trim() : "";
  if (!markdown) {
    return NextResponse.json(
      { error: "Post content is required" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const lexical = markdownToLexicalJson(markdown);
  if (lexical.length < MIN_CONTENT_LEXICAL_LENGTH) {
    // Matches the web guard — Lexical JSON has structural scaffolding
    // so a <50-char serialized tree is effectively empty.
    return NextResponse.json(
      { error: "Post is too short" },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const post = await prisma.post.create({
    data: { content: lexical, authorId: viewerId },
    select: { id: true },
  });
  const wallPost = await prisma.wallPost.create({
    data: { postId: post.id, wallOwnerId: owner.id },
    select: { id: true, status: true },
  });

  // Fire-and-forget notification + cache invalidation (same pattern
  // as the web action).
  try {
    await createNotificationSafe({
      type: "WALL_POST",
      actorId: viewerId,
      targetUserId: owner.id,
      postId: post.id,
    });
  } catch {
    // non-critical
  }
  revalidatePath(`/${owner.username}`);

  return NextResponse.json(
    {
      ok: true,
      postId: post.id,
      wallPostId: wallPost.id,
      status: wallPost.status,
    },
    { headers: corsHeaders(req) },
  );
}
