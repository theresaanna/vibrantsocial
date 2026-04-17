import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { handleCorsPreflightRequest, withCors } from "@/lib/cors";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { scanVideoForCSAM } from "@/lib/video-scan";
import { quarantineUpload } from "@/lib/arachnid-shield";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BLOB_BYTES = 250 * 1024 * 1024;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return withCors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const rateLimited = await checkRateLimit(uploadLimiter, session.user.id);
  if (rateLimited) return withCors(req, rateLimited as NextResponse);

  const body = await req.json().catch(() => null);
  const url: unknown = body && typeof body === "object" ? (body as Record<string, unknown>).url : null;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return withCors(req, NextResponse.json({ error: "Invalid url" }, { status: 400 }));
  }

  let fetchRes: Response;
  try {
    fetchRes = await fetch(url);
  } catch {
    return withCors(req, NextResponse.json({ error: "Could not fetch video" }, { status: 400 }));
  }
  if (!fetchRes.ok) {
    return withCors(req, NextResponse.json({ error: "Could not fetch video" }, { status: 400 }));
  }

  const contentLength = Number(fetchRes.headers.get("content-length") || 0);
  if (contentLength > MAX_BLOB_BYTES) {
    await del(url).catch(() => {});
    return withCors(req, NextResponse.json({ error: "Video too large to scan" }, { status: 413 }));
  }

  const buffer = Buffer.from(await fetchRes.arrayBuffer());
  if (buffer.byteLength > MAX_BLOB_BYTES) {
    await del(url).catch(() => {});
    return withCors(req, NextResponse.json({ error: "Video too large to scan" }, { status: 413 }));
  }

  const mimeType = fetchRes.headers.get("content-type") ?? "video/mp4";
  const fileName = url.split("/").pop() ?? "video";

  const result = await scanVideoForCSAM(buffer);
  if (!result.safe) {
    await del(url).catch(() => {});
    if (result.classification && result.sha256) {
      await quarantineUpload({
        userId: session.user.id,
        classification: result.classification,
        sha256: result.sha256,
        fileName,
        fileSize: buffer.byteLength,
        mimeType,
        uploadEndpoint: "/api/upload/scan-video",
        request: req,
        imageBuffer: buffer,
      });
    }
    return withCors(req, NextResponse.json({ error: "Upload rejected" }, { status: 400 }));
  }

  // Upload the middle frame as a thumbnail. Also serves as the NSFW scan
  // target so the Python moderation service never sees video bytes.
  let thumbUrl: string | null = null;
  if (result.thumbnail) {
    try {
      const thumbBlob = await put(
        `uploads/${session.user.id}-${Date.now()}-thumb.png`,
        result.thumbnail,
        { access: "public", addRandomSuffix: true, contentType: "image/png" }
      );
      thumbUrl = thumbBlob.url;
    } catch {
      // Non-fatal — video still goes through, NSFW scan will just no-op.
    }
  }

  return withCors(req, NextResponse.json({ safe: true, thumbUrl }));
}
