/**
 * Giphy proxy for the mobile GIF picker.
 *
 *   GET /api/v1/giphy?q=<query>&offset=<n>&limit=<n>
 *     → trending when `q` is empty; search when `q` is set.
 *
 * Response:
 *   { gifs: [{ id, url, thumbUrl, previewUrl, width, height, title }],
 *     offset: number, hasMore: boolean }
 *
 * Why proxy instead of letting the Flutter client hit Giphy directly:
 *   - Keeps the key server-side (the web uses `NEXT_PUBLIC_GIPHY_API_KEY`
 *     — prefixed because the browser needs it, but mobile doesn't have
 *     to expose it).
 *   - Lets us force `rating=pg-13` regardless of what the client sends
 *     (Play policy — mobile must never surface R-rated GIFs).
 *   - Normalizes the payload so the Flutter client doesn't parse
 *     Giphy's full shape.
 */
import { NextResponse } from "next/server";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

const GIPHY_ENDPOINT = "https://api.giphy.com/v1/gifs";
const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 25;

// Giphy image format with the fields we pluck per variant.
interface GiphyImageVariant {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id: string;
  title?: string;
  images?: {
    original?: GiphyImageVariant;
    fixed_height?: GiphyImageVariant;
    fixed_height_small?: GiphyImageVariant;
    fixed_width_small?: GiphyImageVariant;
  };
}

interface GiphyResponse {
  data?: GiphyGif[];
  pagination?: { total_count?: number; count?: number; offset?: number };
}

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const apiKey =
    process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Giphy not configured on this server." },
      { status: 503, headers: corsHeaders(req) },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const offset = Math.max(
    0,
    parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );
  const limitRaw = parseInt(
    url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`,
    10,
  );
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw || DEFAULT_LIMIT));

  const giphyUrl = new URL(q ? `${GIPHY_ENDPOINT}/search` : `${GIPHY_ENDPOINT}/trending`);
  giphyUrl.searchParams.set("api_key", apiKey);
  if (q) giphyUrl.searchParams.set("q", q);
  giphyUrl.searchParams.set("offset", String(offset));
  giphyUrl.searchParams.set("limit", String(limit));
  // Play-policy: cap ratings at pg-13 regardless of what the client
  // sent. Giphy's `r` tier can include sexually suggestive content
  // we absolutely don't want on the app.
  giphyUrl.searchParams.set("rating", "pg-13");
  giphyUrl.searchParams.set("bundle", "messaging_non_clips");

  let giphyRes: Response;
  try {
    giphyRes = await fetch(giphyUrl.toString(), {
      // Giphy responses vary per query; don't cache at the edge, but
      // Next's default fetch semantics cache anyway so opt-out
      // explicitly.
      cache: "no-store",
    });
  } catch (err) {
    console.error("[giphy] fetch failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach Giphy." },
      { status: 502, headers: corsHeaders(req) },
    );
  }
  if (!giphyRes.ok) {
    return NextResponse.json(
      { error: `Giphy returned ${giphyRes.status}.` },
      { status: 502, headers: corsHeaders(req) },
    );
  }

  const body = (await giphyRes.json()) as GiphyResponse;
  const gifs = (body.data ?? []).flatMap((g) => {
    const orig = g.images?.original;
    const thumb = g.images?.fixed_width_small ?? g.images?.fixed_height_small;
    const preview = g.images?.fixed_height;
    if (!orig?.url) return [];
    return [
      {
        id: g.id,
        url: orig.url,
        previewUrl: preview?.url ?? orig.url,
        thumbUrl: thumb?.url ?? orig.url,
        width: orig.width ? Number(orig.width) : null,
        height: orig.height ? Number(orig.height) : null,
        title: g.title ?? "",
      },
    ];
  });

  const total = body.pagination?.total_count ?? 0;
  const count = body.pagination?.count ?? gifs.length;
  const nextOffset = offset + count;
  const hasMore = total > nextOffset;

  return NextResponse.json(
    { gifs, offset: nextOffset, hasMore },
    { headers: corsHeaders(req) },
  );
}
