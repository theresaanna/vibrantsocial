/**
 * User lists overview — owned, collaborating, subscribed.
 *
 * GET /api/v1/lists
 *   → { owned: [...], collaborating: [...], subscribed: [...] }
 *
 * Each list row is a compact card: id, name, isPrivate, memberCount,
 * plus ownerUsername for collaborating/subscribed lists (so the client
 * can show "by @alice" without another round-trip).
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

interface ListCard {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  ownerUsername: string | null;
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;

  // Play-policy: mobile never surfaces NSFW lists — even the viewer's
  // own. List management (including NSFW lists) lives on the web; the
  // app should hide them everywhere.
  const [owned, collaborating, subscribed] = await Promise.all([
    prisma.userList.findMany({
      where: { ownerId: userId, isNsfw: false },
      include: {
        _count: { select: { members: true } },
        owner: { select: { username: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userList.findMany({
      where: { collaborators: { some: { userId } }, isNsfw: false },
      include: {
        _count: { select: { members: true } },
        owner: { select: { username: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userListSubscription.findMany({
      where: { userId, list: { isNsfw: false } },
      include: {
        list: {
          include: {
            _count: { select: { members: true } },
            owner: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type OwnedRow = (typeof owned)[number];
  type SubRow = (typeof subscribed)[number];

  const toCard = (l: OwnedRow): ListCard => ({
    id: l.id,
    name: l.name,
    isPrivate: l.isPrivate,
    memberCount: l._count.members,
    ownerUsername: l.owner.username,
  });

  return corsJson(req, {
    owned: owned.map(toCard),
    collaborating: collaborating.map(toCard),
    subscribed: subscribed.map((s: SubRow) => toCard(s.list)),
  });
}
