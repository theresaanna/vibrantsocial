/**
 * Marketplace feed — paginated grid for the Flutter client.
 *
 * GET /api/v1/marketplace/feed?cursor=<iso>
 *   → { posts: [...], hasMore, nextCursor }
 *
 * `posts[*].mediaItems` is server-extracted from the post's Lexical body
 * (same shape as the media feed endpoint) so the client doesn't need a
 * Lexical parser.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";
import { publishedOnly } from "@/app/feed/feed-queries";

const PAGE_SIZE = 30;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  // Unauthenticated callers only see public listings.
  const visibilityFilter = viewerId
    ? {}
    : {
        OR: [
          { author: { isProfilePublic: true } },
          { marketplacePost: { publicListing: true } },
        ],
      };

  // Hard-filter explicit content — Play policy requires mobile never
  // display NSFW / sensitive / graphic material regardless of prefs.
  const rows = await prisma.post.findMany({
    where: {
      ...publishedOnly,
      ...mobileSafePostFilter,
      marketplacePost: { isNot: null },
      ...visibilityFilter,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
    select: {
      id: true,
      slug: true,
      content: true,
      createdAt: true,
      isNsfw: true,
      isGraphicNudity: true,
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          avatar: true,
          image: true,
          profileFrameId: true,
        },
      },
      marketplacePost: {
        select: {
          id: true,
          price: true,
          purchaseUrl: true,
          shippingOption: true,
          shippingPrice: true,
          digitalFile: {
            select: { fileName: true, fileSize: true, isFree: true },
          },
        },
      },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const posts = rows.slice(0, PAGE_SIZE).map((p: (typeof rows)[number]) => ({
    id: p.id,
    slug: p.slug,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    isNsfw: p.isNsfw,
    isGraphicNudity: p.isGraphicNudity,
    author: p.author,
    marketplacePost: p.marketplacePost,
    mediaItems: extractMediaFromLexicalJson(p.content),
  }));

  const nextCursor = hasMore ? posts[posts.length - 1].createdAt : null;
  return corsJson(req, { posts, hasMore, nextCursor });
}
