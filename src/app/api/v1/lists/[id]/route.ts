/**
 * List detail — metadata, members, and viewer role flags.
 *
 * GET /api/v1/lists/:id
 *   → { list, members, role: { isOwner, isCollaborator, isMember, isSubscribed } }
 *
 * Honors the `isPrivate` flag: non-members/collaborators/owners get 404.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

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
    select: {
      id: true,
      name: true,
      ownerId: true,
      isPrivate: true,
      createdAt: true,
      owner: {
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
    },
  });
  if (!list) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }

  const isOwner = list.ownerId === userId;
  const [isCollaborator, isMember, isSubscribed] = await Promise.all([
    isOwner
      ? Promise.resolve(false)
      : prisma.userListCollaborator
          .findUnique({ where: { listId_userId: { listId: id, userId } } })
          .then(Boolean),
    prisma.userListMember
      .findUnique({ where: { listId_userId: { listId: id, userId } } })
      .then(Boolean),
    prisma.userListSubscription
      .findUnique({ where: { listId_userId: { listId: id, userId } } })
      .then(Boolean),
  ]);

  // Private lists are invisible to strangers.
  if (list.isPrivate && !isOwner && !isCollaborator && !isMember) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }

  const members = await prisma.userListMember.findMany({
    where: { listId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      createdAt: true,
      user: {
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
    },
  });

  return corsJson(req, {
    list: {
      id: list.id,
      name: list.name,
      isPrivate: list.isPrivate,
      createdAt: list.createdAt.toISOString(),
      owner: list.owner,
    },
    members: members.map((m: (typeof members)[number]) => ({
      addedAt: m.createdAt.toISOString(),
      user: m.user,
    })),
    role: { isOwner, isCollaborator, isMember, isSubscribed },
  });
}
