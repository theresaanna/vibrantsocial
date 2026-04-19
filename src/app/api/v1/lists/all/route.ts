/**
 * Discover — every user's list, newest first. Backs the "Everyone's
 * Lists" tab on the Flutter lists index.
 *
 * GET /api/v1/lists/all?cursor=<iso>
 *   → { lists: [...], nextCursor }
 *
 * Mirrors `fetchAllUserLists` (src/app/communities/user-lists-actions.ts)
 * but paginates with a createdAt cursor instead of returning every row.
 * Private lists are intentionally excluded — a list's existence is the
 * invitation signal for non-members, so hiding private ones avoids
 * exposing curation graphs unintentionally.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { getUserPrefs } from "@/lib/user-prefs";

const PAGE_SIZE = 30;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const cursorRaw = new URL(req.url).searchParams.get("cursor");
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const prefs = await getUserPrefs(viewer.userId);
  const hideNsfw = !prefs.showNsfwContent;

  const rows = await prisma.userList.findMany({
    where: {
      isPrivate: false,
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
      ...(hideNsfw
        ? { OR: [{ isNsfw: false }, { ownerId: viewer.userId }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    include: {
      _count: { select: { members: true } },
      owner: { select: { username: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lists = page.map((l: (typeof rows)[number]) => ({
    id: l.id,
    name: l.name,
    isPrivate: l.isPrivate,
    memberCount: l._count.members,
    ownerUsername: l.owner.username,
    createdAt: l.createdAt.toISOString(),
  }));
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return corsJson(req, { lists, nextCursor });
}
