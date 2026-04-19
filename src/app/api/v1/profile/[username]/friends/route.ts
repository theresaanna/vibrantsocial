import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import {
  PAGE_SIZE,
  annotateUserEntries,
  parseCursor,
  resolveAssetBaseUrl,
  resolveTarget,
  userListSelect,
  type UserListPage,
} from "@/lib/profile-lists";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

/**
 * `GET /api/v1/profile/:username/friends?cursor=…`
 *
 * Paginated list of :username's accepted friends. A friendship can exist
 * with :username on either the sender or receiver side of the underlying
 * FriendRequest row — we dereference whichever side points at the other
 * user and surface that party. Block enforcement runs post-query since
 * the "friend" field varies per row.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const target = await resolveTarget(username, viewerId);
  if (!target) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  const cursor = parseCursor(req);
  const rows = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: target.targetId },
        { receiverId: target.targetId },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      sender: { select: userListSelect },
      receiver: { select: userListSelect },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // The "other side" of each friendship — the user that's actually being
  // listed, as opposed to :username themself.
  const rawUsers = page.map((r) =>
    r.senderId === target.targetId ? r.receiver : r.sender,
  );

  // Viewer-side block filtering (post-query — cheaper than a nested query
  // with both senderId/receiverId alternates).
  let filteredUsers = rawUsers;
  if (viewerId) {
    const ids = rawUsers.map((u) => u.id);
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: { in: ids } },
          { blockedId: viewerId, blockerId: { in: ids } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = new Set(
      blocks.flatMap((b) => [b.blockerId, b.blockedId]),
    );
    filteredUsers = rawUsers.filter((u) => !blockedIds.has(u.id));
  }

  const users = await annotateUserEntries(
    viewerId,
    filteredUsers,
    resolveAssetBaseUrl(req),
  );

  const body: UserListPage = { users, nextCursor };
  return NextResponse.json(body, { headers: corsHeaders(req) });
}
