import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import {
  PAGE_SIZE,
  annotateUserEntries,
  hideBlockedClause,
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
 * `GET /api/v1/profile/:username/followers?cursor=…`
 *
 * Paginated list of users following :username. Cursor is a Follow row id;
 * stable newest-first ordering. Users that have blocked the viewer (or
 * vice versa) are elided from results.
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
  const rows = await prisma.follow.findMany({
    where: {
      followingId: target.targetId,
      ...hideBlockedClause(viewerId, "follower"),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      follower: { select: userListSelect },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const users = await annotateUserEntries(
    viewerId,
    page.map((r) => r.follower),
    resolveAssetBaseUrl(req),
  );

  const body: UserListPage = { users, nextCursor };
  return NextResponse.json(body, { headers: corsHeaders(req) });
}

