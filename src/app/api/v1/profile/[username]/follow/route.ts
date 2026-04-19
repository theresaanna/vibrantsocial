/**
 * Follow / unfollow a profile.
 *
 * POST   /api/v1/profile/:username/follow → idempotent add
 * DELETE /api/v1/profile/:username/follow → idempotent remove
 *
 * Returns `{ isFollowing: boolean, followers: number }`.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { username } = await params;

  const target = await resolveTarget(username);
  if (!target) return corsJson(req, { error: "User not found" }, { status: 404 });
  if (target.id === viewer.userId) {
    return corsJson(req, { error: "Cannot follow yourself" }, { status: 400 });
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: viewer.userId,
        followingId: target.id,
      },
    },
    create: { followerId: viewer.userId, followingId: target.id },
    update: {},
  });
  const followers = await prisma.follow.count({
    where: { followingId: target.id },
  });
  return corsJson(req, { isFollowing: true, followers });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { username } = await params;

  const target = await resolveTarget(username);
  if (!target) return corsJson(req, { error: "User not found" }, { status: 404 });

  await prisma.follow.deleteMany({
    where: { followerId: viewer.userId, followingId: target.id },
  });
  const followers = await prisma.follow.count({
    where: { followingId: target.id },
  });
  return corsJson(req, { isFollowing: false, followers });
}

async function resolveTarget(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
}
