import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { resolveAssetBaseUrl, resolveTarget } from "@/lib/profile-lists";
import { postSelect, serializePosts } from "@/lib/post-serializer";

const PAGE_SIZE = 20;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * `GET /api/v1/profile/:username/posts?cursor=<iso>` — posts authored by
 * :username. Ordered newest-first. Same scoping caveats as the home feed
 * (no close-friends / custom-audience posts surfaced to outsiders); the
 * viewer's own profile sees their full post history.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const target = await resolveTarget(username, viewerId);
  if (!target) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const isSelf = viewerId === target.targetId;

  const rows = await prisma.post.findMany({
    where: {
      isAuthorDeleted: false,
      authorId: target.targetId,
      scheduledFor: null,
      // Outsiders don't see close-friends / custom-audience posts. Owners
      // see everything they've written.
      ...(isSelf
        ? {}
        : { isCloseFriendsOnly: false, hasCustomAudience: false }),
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: PAGE_SIZE + 1,
    select: postSelect,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const serialized = await serializePosts(
    page,
    viewerId,
    resolveAssetBaseUrl(req),
  );
  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  return NextResponse.json(
    { posts: serialized, nextCursor },
    { headers: corsHeaders(req) },
  );
}
