/**
 * Friend-request lifecycle for a profile.
 *
 *   POST   …/friend          → send a PENDING request (viewer → target)
 *                              If there's already an incoming PENDING
 *                              request from the target, it's accepted
 *                              instead — symmetric "friend" behaviour.
 *   DELETE …/friend          → cancel an outgoing PENDING request OR
 *                              remove an accepted friendship, depending
 *                              on current state.
 *   POST   …/friend/accept   → accept an incoming PENDING request.
 *
 * Returns the new `friendRequestOutgoing` / `friendRequestIncoming` /
 * `isFriend` triple so the client can reconcile optimistic state.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

interface RelationshipStatus {
  isFriend: boolean;
  friendRequestOutgoing: boolean;
  friendRequestIncoming: boolean;
  friends: number;
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
    return corsJson(req, { error: "Cannot friend yourself" }, { status: 400 });
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: viewer.userId, receiverId: target.id },
        { senderId: target.id, receiverId: viewer.userId },
      ],
    },
    select: { id: true, status: true, senderId: true },
  });

  if (existing?.status === "ACCEPTED") {
    return corsJson(req, await statusFor(viewer.userId, target.id));
  }

  if (existing?.status === "PENDING") {
    if (existing.senderId === target.id) {
      // Symmetric: if they already asked us, POST acts as acceptance.
      await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      });
    }
    // Otherwise already outgoing — leave as-is.
    return corsJson(req, await statusFor(viewer.userId, target.id));
  }

  await prisma.friendRequest.create({
    data: {
      senderId: viewer.userId,
      receiverId: target.id,
      status: "PENDING",
    },
  });
  return corsJson(req, await statusFor(viewer.userId, target.id));
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

  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: viewer.userId, receiverId: target.id },
        { senderId: target.id, receiverId: viewer.userId },
      ],
    },
  });
  return corsJson(req, await statusFor(viewer.userId, target.id));
}

async function resolveTarget(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
}

async function statusFor(
  viewerId: string,
  targetId: string,
): Promise<RelationshipStatus> {
  const fr = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: viewerId, receiverId: targetId },
        { senderId: targetId, receiverId: viewerId },
      ],
    },
    select: { status: true, senderId: true },
  });
  const friends = await prisma.friendRequest.count({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: targetId }, { receiverId: targetId }],
    },
  });
  return {
    isFriend: fr?.status === "ACCEPTED",
    friendRequestOutgoing: fr?.status === "PENDING" && fr.senderId === viewerId,
    friendRequestIncoming: fr?.status === "PENDING" && fr.senderId === targetId,
    friends,
  };
}
