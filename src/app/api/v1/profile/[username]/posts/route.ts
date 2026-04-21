import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { resolveAssetBaseUrl, resolveTarget } from "@/lib/profile-lists";
import {
  postSelect,
  serializePosts,
  serializePost,
} from "@/lib/post-serializer";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";
import { areFriends } from "@/lib/action-utils";

const PAGE_SIZE = 20;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * `GET /api/v1/profile/:username/posts?cursor=<iso>` — the target's
 * profile feed. Returns the user's authored posts and, when the target
 * has NOT opted into a separate Wall tab (`hideWallFromFeed=false`) and
 * the viewer can see the wall, also returns wall posts for client-side
 * interleaving. Mirrors the web behavior where `showWallOnPostsTab`
 * controls whether wall entries render in the Posts tab or on a
 * dedicated one.
 *
 * Response:
 *   {
 *     posts:           SerializedPost[],
 *     wallPosts:       { wallPostId, status, createdAt, post }[],
 *     canModerateWall: boolean,  // viewer owns this wall
 *     nextCursor:      string | null
 *   }
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

  const targetUser = await prisma.user.findUnique({
    where: { id: target.targetId },
    select: { hideWallFromFeed: true },
  });
  const hideWallFromFeed = targetUser?.hideWallFromFeed ?? false;

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const isSelf = viewerId === target.targetId;
  const isFriend =
    !isSelf && viewerId ? await areFriends(viewerId, target.targetId) : false;
  const canSeeWall = isSelf || isFriend;
  const includeWall = !hideWallFromFeed && canSeeWall && viewerId != null;

  // Wall-owner sees pending + accepted inline so moderation affordances
  // still appear on the Posts tab. Everyone else sees accepted only.
  const wallStatusFilter = isSelf
    ? { in: ["pending", "accepted"] as const }
    : "accepted";

  const authoredRows = await prisma.post.findMany({
    where: {
      // Play-policy: mobile always hides explicit content, even on
      // the viewer's own profile.
      ...mobileSafePostFilter,
      isAuthorDeleted: false,
      authorId: target.targetId,
      scheduledFor: null,
      // Outsiders don't see close-friends / custom-audience posts.
      // Owners see everything they've written.
      ...(isSelf
        ? {}
        : { isCloseFriendsOnly: false, hasCustomAudience: false }),
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: PAGE_SIZE + 1,
    select: postSelect,
  });

  const wallRows = includeWall
    ? await prisma.wallPost.findMany({
        where: {
          wallOwnerId: target.targetId,
          status:
            typeof wallStatusFilter === "string"
              ? wallStatusFilter
              : { in: [...wallStatusFilter.in] },
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
      })
    : [];

  // Build a merged index so we can page both streams off a single
  // createdAt cursor. Pinned authored posts win first; otherwise
  // createdAt desc.
  type MergedRef =
    | { kind: "post"; idx: number; createdAt: Date; isPinned: boolean }
    | { kind: "wall"; idx: number; createdAt: Date };

  const merged: MergedRef[] = [];
  for (let i = 0; i < authoredRows.length; i++) {
    const p = authoredRows[i];
    merged.push({
      kind: "post",
      idx: i,
      createdAt: p.createdAt,
      isPinned: p.isPinned,
    });
  }
  for (let i = 0; i < wallRows.length; i++) {
    merged.push({
      kind: "wall",
      idx: i,
      createdAt: wallRows[i].createdAt,
    });
  }
  merged.sort((a, b) => {
    const aPinned = a.kind === "post" && a.isPinned ? 1 : 0;
    const bPinned = b.kind === "post" && b.isPinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const hasMore = merged.length > PAGE_SIZE;
  const page = merged.slice(0, PAGE_SIZE);
  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  const assetBaseUrl = resolveAssetBaseUrl(req);
  const includedPosts = page
    .filter((m) => m.kind === "post")
    .map((m) => authoredRows[m.idx]);
  const includedWalls = page
    .filter((m) => m.kind === "wall")
    .map((m) => wallRows[m.idx]);

  const [serializedPosts, serializedWalls] = await Promise.all([
    serializePosts(includedPosts, viewerId, assetBaseUrl),
    Promise.all(
      includedWalls.map(async (w) => ({
        wallPostId: w.id,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
        post: await serializePost(w.post, viewerId, assetBaseUrl),
      })),
    ),
  ]);

  return NextResponse.json(
    {
      posts: serializedPosts,
      wallPosts: serializedWalls,
      canModerateWall: isSelf,
      nextCursor,
    },
    { headers: corsHeaders(req) },
  );
}
