/**
 * Tag feed for the mobile Explore → tag detail screen.
 *
 *   GET /api/v1/tags/:name/feed?cursor=<postTagId>
 *     → { tag: { name, postCount }, posts: [...], nextCursor }
 *
 * Play-policy:
 *   - NSFW tags 404 outright (`Tag.isNsfw = true` never surfaces).
 *   - Posts are run through `mobileSafePostFilter` regardless of the
 *     viewer's `showNsfwContent` preference.
 *   - Marketplace posts are excluded (they live in their own feed).
 *
 * Cursor is the `PostTag.id` of the last returned row — same convention
 * the web action uses so the two clients can interoperate if needed.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { postSelect, serializePost } from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";

const PAGE_SIZE = 20;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const viewerId = viewer.userId;

  const { name: rawName } = await params;
  // Normalize the way the rest of the codebase does: strip leading `#`,
  // lower-case, trim. Empty-after-normalize → 404.
  const name = rawName.replace(/^#/, "").trim().toLowerCase();
  if (!name) {
    return NextResponse.json(
      { error: "Tag not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const tag = await prisma.tag.findUnique({
    where: { name },
    select: { id: true, name: true, isNsfw: true },
  });
  if (!tag || tag.isNsfw) {
    return NextResponse.json(
      { error: "Tag not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const cursor = new URL(req.url).searchParams.get("cursor");

  const postWhere = {
    ...mobileSafePostFilter,
    isAuthorDeleted: false,
    scheduledFor: null,
    isCloseFriendsOnly: false,
    hasCustomAudience: false,
    marketplacePost: null,
  };

  const [rows, postCount] = await Promise.all([
    prisma.postTag.findMany({
      where: { tag: { name }, post: postWhere },
      orderBy: { post: { createdAt: "desc" } },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        post: { select: postSelect },
      },
    }),
    prisma.postTag.count({
      where: { tag: { name }, post: postWhere },
    }),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const assetBaseUrl = resolveAssetBaseUrl(req);
  const posts = await Promise.all(
    page.map((r) => serializePost(r.post, viewerId, assetBaseUrl)),
  );

  const nextCursor = hasMore ? page[page.length - 1].id : null;
  return NextResponse.json(
    {
      tag: { name: tag.name, postCount },
      posts,
      nextCursor,
    },
    { headers: corsHeaders(req) },
  );
}
