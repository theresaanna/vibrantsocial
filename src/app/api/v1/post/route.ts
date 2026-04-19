/**
 * Create a post from the mobile composer.
 *
 * `POST /api/v1/post`
 *   {
 *     text: string,                 // plain text with \n\n between paragraphs
 *     tags?: string[],
 *     images?: { src, altText? }[], // pre-uploaded to Vercel Blob
 *     youtubeVideoId?: string,      // overrides auto-detection when set
 *     poll?: { question, options: { text }[] },
 *     isNsfw?: bool,
 *     isSensitive?: bool,
 *     isGraphicNudity?: bool,
 *   }
 *
 * The server synthesizes the Lexical JSON body so the rest of the
 * system (serializer, feed, profile posts) treats the post identically
 * to one composed on the web.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { extractTagsFromNames } from "@/lib/tags";
import { generateSlugFromContent } from "@/lib/slugs";
import {
  buildLexicalContent,
  detectYouTubeVideoId,
  type MobileComposeInput,
} from "@/lib/compose";
import {
  postSelect,
  serializePost,
} from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimited = await checkRateLimit(
    apiLimiter,
    `mobile-post:${viewer.userId}:${ip}`,
  );
  if (rateLimited) return rateLimited;

  if (!(await requireNotSuspended(viewer.userId))) {
    return corsJson(req, { error: "Account suspended" }, { status: 403 });
  }
  if (!(await requirePhoneVerification(viewer.userId))) {
    return corsJson(
      req,
      { error: "Phone verification required to post" },
      { status: 403 },
    );
  }
  if (!(await requireMinimumAge(viewer.userId, 18))) {
    return corsJson(
      req,
      { error: "You must be 18 or older to post" },
      { status: 403 },
    );
  }

  let body: MobileComposeInput & {
    tags?: unknown;
    isNsfw?: unknown;
    isSensitive?: unknown;
    isGraphicNudity?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim();
  if (!text && !body.youtubeVideoId && (body.images?.length ?? 0) === 0) {
    return corsJson(
      req,
      { error: "Post needs text, an image, or a YouTube link." },
      { status: 400 },
    );
  }
  if (text.length > 20000) {
    return corsJson(req, { error: "Post is too long." }, { status: 400 });
  }

  // Play-policy: the Flutter client must never create NSFW / sensitive
  // / graphic posts. We ignore any such flags in the request body and
  // force them false server-side, so a mobile-authored post stays
  // clean even if the compose form is tampered with.
  const isNsfw = false;
  const isSensitive = false;
  const isGraphicNudity = false;

  // Build Lexical content: paragraphs with autolinks + optional YT / images / poll.
  const youtubeVideoId =
    body.youtubeVideoId ?? detectYouTubeVideoId(text) ?? undefined;
  const content = buildLexicalContent({
    text,
    youtubeVideoId,
    images: body.images,
    poll: body.poll,
  });

  // Slug: auto-generate, resolve collision against this author.
  const slug = await resolveUniqueSlug(
    viewer.userId,
    generateSlugFromContent(content) || "post",
  );

  const created = await prisma.post.create({
    data: {
      content,
      slug,
      authorId: viewer.userId,
      isNsfw,
      isSensitive,
      isGraphicNudity,
    },
    select: postSelect,
  });

  // Tag attach — skip for sensitive / graphic per web policy.
  const rawTags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string")
    : [];
  if (rawTags.length > 0 && !isSensitive && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags);
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.postTag.create({
        data: { postId: created.id, tagId: tag.id },
      });
    }
  }

  // Stars + notification side effects are web-feature-heavy; they'll
  // land when the mobile notification slice is next. Keep this path
  // tight to the "post appears in feeds" critical path for now.
  await prisma.user.update({
    where: { id: viewer.userId },
    data: { stars: { increment: 1 } },
  });

  // Re-read with tags included for serialization.
  const full = await prisma.post.findUniqueOrThrow({
    where: { id: created.id },
    select: postSelect,
  });
  const serialized = await serializePost(
    full,
    viewer.userId,
    resolveAssetBaseUrl(req),
  );

  return NextResponse.json(
    { post: serialized },
    { status: 201, headers: corsHeaders(req) },
  );
}

async function resolveUniqueSlug(
  authorId: string,
  baseSlug: string,
): Promise<string> {
  let candidate = baseSlug || "post";
  let suffix = 1;
  while (true) {
    const existing = await prisma.post.findFirst({
      where: { authorId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}
