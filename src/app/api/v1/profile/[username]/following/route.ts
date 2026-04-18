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
 * `GET /api/v1/profile/:username/following?cursor=…`
 *
 * Paginated list of users that :username follows. Same shape and ordering
 * guarantees as /followers.
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
      followerId: target.targetId,
      ...hideBlockedClause(viewerId, "following"),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      following: { select: userListSelect },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  const users = await annotateUserEntries(
    viewerId,
    page.map((r) => r.following),
    resolveAssetBaseUrl(req),
  );

  const body: UserListPage = { users, nextCursor };
  return NextResponse.json(body, { headers: corsHeaders(req) });
}
