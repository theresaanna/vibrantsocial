/**
 * List feed — posts authored by any member of a user list.
 *
 * GET /api/v1/lists/:id/feed?cursor=<iso>
 *   → { posts: [...], nextCursor }
 *
 * v1 scope intentionally narrow: direct posts only (no reposts), no
 * close-friends / custom-audience fan-in. The web route does more of
 * that; we'll catch up once the Flutter client shows these. Private
 * lists: only owner, collaborators, members, and subscribers can read.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { postSelect, serializePosts } from "@/lib/post-serializer";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import { mobileSafePostFilter } from "@/lib/mobile-safe-content";

const PAGE_SIZE = 20;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;
  const { id } = await params;

  const list = await prisma.userList.findUnique({
    where: { id },
    select: { ownerId: true, isPrivate: true, isNsfw: true },
  });
  if (!list) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }
  // Play-policy: NSFW lists are invisible on mobile (matches the detail
  // route's 404).
  if (list.isNsfw) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }

  const isOwner = list.ownerId === userId;
  let canView = isOwner;
  if (!canView) {
    const [collab, member, sub] = await Promise.all([
      prisma.userListCollaborator.findUnique({
        where: { listId_userId: { listId: id, userId } },
      }),
      prisma.userListMember.findUnique({
        where: { listId_userId: { listId: id, userId } },
      }),
      prisma.userListSubscription.findUnique({
        where: { listId_userId: { listId: id, userId } },
      }),
    ]);
    // Private: owner/collab/member. Public: above + subscribers.
    canView = !!collab || !!member || (!list.isPrivate && !!sub);
  }
  if (!canView) {
    return corsJson(req, { error: "Forbidden" }, { status: 403 });
  }

  const [memberRows, blockRows] = await Promise.all([
    prisma.userListMember.findMany({
      where: { listId: id },
      select: { userId: true },
    }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const blockedIds = new Set(
    blockRows
      .flatMap((b: (typeof blockRows)[number]) => [b.blockerId, b.blockedId])
      .filter((v: string) => v !== userId),
  );
  const memberIds = memberRows
    .map((m: (typeof memberRows)[number]) => m.userId)
    .filter((mid: string) => !blockedIds.has(mid));

  if (memberIds.length === 0) {
    return corsJson(req, { posts: [], nextCursor: null });
  }

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  // Mobile always hard-filters explicit content (Play policy).
  const rows = await prisma.post.findMany({
    where: {
      ...mobileSafePostFilter,
      isAuthorDeleted: false,
      authorId: { in: memberIds },
      scheduledFor: null,
      isCloseFriendsOnly: false,
      hasCustomAudience: false,
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    select: postSelect,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const serialized = await serializePosts(page, userId, resolveAssetBaseUrl(req));
  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  return corsJson(req, { posts: serialized, nextCursor });
}
