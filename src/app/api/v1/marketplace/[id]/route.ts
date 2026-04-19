/**
 * Single marketplace listing — detail view for the Flutter client.
 *
 * GET /api/v1/marketplace/:id
 *   → { post: { ...fields, mediaItems }, questions: [...] }
 *
 * Returns 404 when the post isn't a marketplace listing or the viewer
 * can't see it (logged-out + not a public listing).
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const post = await prisma.post.findUnique({
    where: { id },
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
          isProfilePublic: true,
        },
      },
      marketplacePost: {
        select: {
          id: true,
          price: true,
          purchaseUrl: true,
          shippingOption: true,
          shippingPrice: true,
          publicListing: true,
          digitalFile: {
            select: { fileName: true, fileSize: true, isFree: true },
          },
        },
      },
    },
  });

  if (!post?.marketplacePost) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }

  // Visibility gate for logged-out viewers.
  if (!viewerId) {
    const publicProfile = post.author?.isProfilePublic === true;
    const publicListing = post.marketplacePost.publicListing;
    if (!publicProfile && !publicListing) {
      return corsJson(req, { error: "Not found" }, { status: 404 });
    }
  }

  const questions = await prisma.marketplaceQuestion.findMany({
    where: { marketplacePostId: post.marketplacePost.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      question: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
      asker: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          image: true,
          profileFrameId: true,
        },
      },
    },
  });

  // Strip the server-only `isProfilePublic` and `publicListing` before
  // returning so the shape matches the feed route.
  const { isProfilePublic: _ip, ...authorOut } = post.author ?? {};
  const { publicListing: _pl, ...marketplaceOut } = post.marketplacePost;

  return corsJson(req, {
    post: {
      id: post.id,
      slug: post.slug,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      isNsfw: post.isNsfw,
      isGraphicNudity: post.isGraphicNudity,
      author: post.author ? authorOut : null,
      marketplacePost: marketplaceOut,
      mediaItems: extractMediaFromLexicalJson(post.content),
    },
    questions: questions.map((q: (typeof questions)[number]) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      asker: q.asker,
    })),
  });
}
