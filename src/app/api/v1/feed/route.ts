import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import {
  postSelect,
  serializePosts,
  type SerializedPost,
} from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import { getUserPrefs } from "@/lib/user-prefs";

const PAGE_SIZE = 20;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * `GET /api/v1/feed?cursor=<iso timestamp>` — authenticated home feed.
 *
 * V1 scope: posts by the viewer and accounts the viewer follows, minus
 * blocked-user content, minus close-friends / custom-audience posts
 * (those slices land later), minus not-yet-published scheduled drafts.
 * Reposts and wall posts are deferred to the interactions slice.
 */
export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders(req) },
    );
  }

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const [followingRows, blocks] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    }),
    prisma.block.findMany({
      where: {
        OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const blockedIds = new Set(
    blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== viewerId),
  );
  const authorIds = [
    viewerId,
    ...followingRows.map((f) => f.followingId).filter((id) => !blockedIds.has(id)),
  ];

  const prefs = await getUserPrefs(viewerId);
  const { showNsfwContent, ageVerified, hideSensitiveOverlay, showGraphicByDefault } = prefs;

  const rows = await prisma.post.findMany({
    where: {
      isAuthorDeleted: false,
      authorId: { in: authorIds },
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      scheduledFor: null,
      ...(!showNsfwContent ? { isNsfw: false } : {}),
      ...(!showNsfwContent || !ageVerified || !hideSensitiveOverlay
        ? { isSensitive: false }
        : {}),
      ...(!showNsfwContent || !ageVerified || !showGraphicByDefault
        ? { isGraphicNudity: false }
        : {}),
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    select: postSelect,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const serialized: SerializedPost[] = await serializePosts(
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
