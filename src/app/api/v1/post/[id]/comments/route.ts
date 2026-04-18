import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { postAuthorSelect } from "@/lib/post-serializer";
import {
  resolveAssetBaseUrl,
  resolveAvatarFrame,
  resolveFontFamily,
  type SerializedAvatarFrame,
} from "@/lib/profile-lists";
import {
  extractBlocksFromCommentText,
  type Block,
} from "@/lib/lexical-blocks";
import { requireViewer } from "@/lib/require-viewer";

const PAGE_SIZE = 30;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

interface SerializedCommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  tier: string;
  verified: boolean;
  usernameFontFamily: string | null;
  frame: SerializedAvatarFrame | null;
}

interface SerializedComment {
  id: string;
  /** Plain-text fallback, kept for search / notifications / previews. */
  content: string;
  /** Structured rendering blocks — use this on the mobile client. */
  blocks: Block[];
  imageUrl: string | null;
  parentId: string | null;
  createdAt: string;
  editedAt: string | null;
  author: SerializedCommentAuthor;
  replyCount: number;
}

/**
 * `GET /api/v1/post/:id/comments?cursor=<comment-id>`
 *
 * Top-level comments for a post, oldest-first. Reply threads aren't
 * expanded inline — callers load a specific comment's replies via
 * (future) /api/v1/comment/:id/replies. For v1 we just surface the
 * top-level count under `replyCount`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isAuthorDeleted: true },
  });
  if (!post || post.isAuthorDeleted) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  // Filter comments from users the viewer has blocked or been blocked by.
  const blockedIds = new Set<string>();
  if (viewerId) {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
      },
      select: { blockerId: true, blockedId: true },
    });
    for (const b of blocks) {
      blockedIds.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);
    }
  }

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw && cursorRaw.length > 0 ? cursorRaw : null;

  const rows = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null,
      ...(blockedIds.size > 0
        ? { authorId: { notIn: [...blockedIds] } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      imageUrl: true,
      parentId: true,
      createdAt: true,
      editedAt: true,
      author: { select: postAuthorSelect },
      _count: { select: { replies: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const assetBaseUrl = resolveAssetBaseUrl(req);
  const comments: SerializedComment[] = page.map((c) => ({
    id: c.id,
    content: c.content,
    blocks: extractBlocksFromCommentText(c.content, c.imageUrl),
    imageUrl: c.imageUrl,
    parentId: c.parentId,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    author: {
      id: c.author.id,
      username: c.author.username,
      displayName: c.author.displayName,
      name: c.author.name,
      avatar: c.author.avatar ?? c.author.image,
      tier: c.author.tier ?? "free",
      verified: c.author.emailVerified != null,
      usernameFontFamily: resolveFontFamily(
        c.author.usernameFont,
        c.author.tier,
      ),
      frame: resolveAvatarFrame(c.author.profileFrameId, assetBaseUrl),
    },
    replyCount: c._count.replies,
  }));

  return NextResponse.json(
    { comments, nextCursor },
    { headers: corsHeaders(req) },
  );
}

const MAX_COMMENT_LENGTH = 5000;

/**
 * `POST /api/v1/post/:id/comments`
 *   { content: string, imageUrl?: string }
 *
 * Creates a top-level comment on :id and returns the serialized comment
 * shape matching the GET response (minus pagination). Reply threading
 * lands in a later slice; parentId isn't accepted here yet.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id: postId } = await params;

  let body: { content?: string; imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (!content) {
    return corsJson(req, { error: "Comment cannot be empty" }, { status: 400 });
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return corsJson(
      req,
      { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isAuthorDeleted: true },
  });
  if (!post || post.isAuthorDeleted) {
    return corsJson(req, { error: "Post not found" }, { status: 404 });
  }

  const created = await prisma.comment.create({
    data: {
      postId,
      authorId: viewer.userId,
      content,
      imageUrl: body.imageUrl ?? null,
    },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      parentId: true,
      createdAt: true,
      editedAt: true,
      author: { select: postAuthorSelect },
      _count: { select: { replies: true } },
    },
  });

  const assetBaseUrl = resolveAssetBaseUrl(req);
  const serialized: SerializedComment = {
    id: created.id,
    content: created.content,
    blocks: extractBlocksFromCommentText(created.content, created.imageUrl),
    imageUrl: created.imageUrl,
    parentId: created.parentId,
    createdAt: created.createdAt.toISOString(),
    editedAt: created.editedAt?.toISOString() ?? null,
    author: {
      id: created.author.id,
      username: created.author.username,
      displayName: created.author.displayName,
      name: created.author.name,
      avatar: created.author.avatar ?? created.author.image,
      tier: created.author.tier ?? "free",
      verified: created.author.emailVerified != null,
      usernameFontFamily: resolveFontFamily(
        created.author.usernameFont,
        created.author.tier,
      ),
      frame: resolveAvatarFrame(created.author.profileFrameId, assetBaseUrl),
    },
    replyCount: created._count.replies,
  };

  return NextResponse.json(
    { comment: serialized },
    { status: 201, headers: corsHeaders(req) },
  );
}
