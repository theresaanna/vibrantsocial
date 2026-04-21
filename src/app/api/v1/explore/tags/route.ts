/**
 * Trending tag cloud for the mobile Explore screen.
 *
 *   GET /api/v1/explore/tags?offset=0&limit=50
 *     → { tags: [{ name, postCount }], hasMore: boolean }
 *
 * Play-policy note: NSFW tags are excluded from the list entirely —
 * not just dimmed — so the mobile discovery surface never surfaces
 * them, regardless of the viewer's `showNsfwContent` preference. The
 * underlying posts are also filtered when counting (we only count
 * posts that pass `mobileSafePostFilter`) so the numeric post count
 * aligns with what the tag feed will actually show.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw || DEFAULT_LIMIT));

  // Query one extra row to compute `hasMore` cheaply.
  const rows = await prisma.tag.findMany({
    where: { isNsfw: false },
    select: {
      name: true,
      _count: {
        select: {
          posts: {
            where: {
              post: {
                ...mobileSafePostFilter,
                isAuthorDeleted: false,
                scheduledFor: null,
                isCloseFriendsOnly: false,
                hasCustomAudience: false,
              },
            },
          },
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    skip: offset,
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json(
    {
      tags: page
        .map((r) => ({ name: r.name, postCount: r._count.posts }))
        // Tags with zero mobile-safe posts aren't interesting on
        // mobile — skip them so the cloud doesn't dilute.
        .filter((t) => t.postCount > 0),
      hasMore,
    },
    { headers: corsHeaders(req) },
  );
}
