import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { postSelect, serializePost } from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * `GET /api/v1/post/:id` — single post with viewer state.
 *
 * `id` is the Prisma cuid. Slug-based lookups (`/{username}/post/{slug}`)
 * stay on the web app — mobile deep-links use ids.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const post = await prisma.post.findUnique({
    where: { id },
    select: postSelect,
  });
  if (!post) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  // Block enforcement: hide posts by authors the viewer blocked or who
  // blocked the viewer. We load blocks lazily since most viewers won't
  // have any.
  if (viewerId && post.author && post.author.id !== viewerId) {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: post.author.id },
          { blockerId: post.author.id, blockedId: viewerId },
        ],
      },
      select: { id: true },
    });
    if (block) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404, headers: corsHeaders(req) },
      );
    }
  }

  const serialized = await serializePost(
    post,
    viewerId,
    resolveAssetBaseUrl(req),
  );
  return NextResponse.json({ post: serialized }, { headers: corsHeaders(req) });
}
