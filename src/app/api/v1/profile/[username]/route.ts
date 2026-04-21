/**
 * Public profile read endpoint.
 *
 * GET /api/v1/profile/:username
 *   Returns the full profile paint for the given username in one
 *   round-trip: user fields, resolved theme, counts, viewer-relative
 *   relationship flags, and the optional links-page entries.
 *
 * Authentication is optional. When a valid cookie-session or bearer
 * token is present, the `relationship` block reflects the viewer;
 * otherwise every relationship flag is `false`. Blocks are enforced
 * both ways — a user blocked by the target (or blocking them) gets a
 * 404 so existence isn't leaked.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, handleCorsPreflightRequest } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import {
  resolveUserTheme,
  themeResolverUserSelect,
  type ResolvedUserTheme,
} from "@/lib/theme-resolver";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import {
  extractTextFromLexicalJson,
  extractLinkedSegmentsFromLexicalJson,
} from "@/lib/lexical-text";
import { extractBlocksFromLexicalJson } from "@/lib/lexical-blocks";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const session = await getSessionFromRequest(req);
  const viewerId = session?.user?.id ?? null;

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      ...themeResolverUserSelect,
      username: true,
      displayName: true,
      name: true,
      avatar: true,
      image: true,
      bio: true,
      createdAt: true,
      suspended: true,
      emailVerified: true,
      hideWallFromFeed: true,
      _count: {
        select: {
          // Follow relations: follower=me following them / following=me being followed
          followers: true, // people following THIS user
          following: true, // people THIS user follows
          posts: true,
          statuses: true,
        },
      },
    },
  });

  if (!user || user.suspended) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  // Enforce bidirectional blocks before doing anything viewer-relative.
  let blockedByMe = false;
  let isBlocked = false;
  if (viewerId && viewerId !== user.id) {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: user.id },
          { blockerId: user.id, blockedId: viewerId },
        ],
      },
      select: { blockerId: true },
    });
    for (const b of blocks) {
      if (b.blockerId === viewerId) blockedByMe = true;
      else isBlocked = true;
    }
    if (isBlocked) {
      // Don't leak that the target blocked us.
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(req) },
      );
    }
  }

  const relationship = await buildRelationship(viewerId, user.id, blockedByMe);
  const theme = resolveUserTheme(user, {
    assetBaseUrl: resolveAssetBaseUrl(req),
  });
  // Bio is Lexical JSON on the web. Surface three shapes so callers can
  // pick their rendering fidelity:
  //   - `bioPlain`    plain text (good for headers / previews)
  //   - `bioSegments` flat inline text+link segments
  //   - `bioBlocks`   full structured blocks, same format as post bodies,
  //                   so clients can render inline images / YouTube
  //                   embeds via the same renderer they use for posts.
  const bioPlain = user.bio ? extractTextFromLexicalJson(user.bio) : null;
  const bioSegments = user.bio
    ? extractLinkedSegmentsFromLexicalJson(user.bio)
    : [];
  const bioBlocks = user.bio ? extractBlocksFromLexicalJson(user.bio) : [];

  return NextResponse.json(
    {
      version: 1,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        name: user.name,
        avatar: user.avatar ?? user.image,
        bio: user.bio,
        bioPlain,
        bioSegments,
        bioBlocks,
        tier: user.tier ?? "free",
        verified: user.emailVerified != null,
        createdAt: user.createdAt.toISOString(),
        hideWallFromFeed: user.hideWallFromFeed,
      },
      theme: theme satisfies ResolvedUserTheme,
      counts: {
        followers: user._count.followers,
        following: user._count.following,
        friends: await countFriends(user.id),
        posts: user._count.posts,
        statuses: user._count.statuses,
      },
      relationship,
    },
    { headers: corsHeaders(req) },
  );
}

async function countFriends(userId: string): Promise<number> {
  return prisma.friendRequest.count({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
  });
}

interface Relationship {
  isSelf: boolean;
  isFollowing: boolean;
  followsMe: boolean;
  isFriend: boolean;
  friendRequestOutgoing: boolean;
  friendRequestIncoming: boolean;
  blockedByMe: boolean;
  canMessage: boolean;
}

async function buildRelationship(
  viewerId: string | null,
  targetId: string,
  blockedByMe: boolean,
): Promise<Relationship> {
  const defaults: Relationship = {
    isSelf: false,
    isFollowing: false,
    followsMe: false,
    isFriend: false,
    friendRequestOutgoing: false,
    friendRequestIncoming: false,
    blockedByMe,
    canMessage: false,
  };

  if (!viewerId) return defaults;
  if (viewerId === targetId) {
    return { ...defaults, isSelf: true, canMessage: false };
  }

  const [outFollow, inFollow, fr] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: targetId },
      },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: targetId, followingId: viewerId },
      },
      select: { id: true },
    }),
    prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: viewerId, receiverId: targetId },
          { senderId: targetId, receiverId: viewerId },
        ],
      },
      select: { senderId: true, status: true },
    }),
  ]);

  const isFriend = fr?.status === "ACCEPTED";
  const friendRequestOutgoing = fr?.status === "PENDING" && fr.senderId === viewerId;
  const friendRequestIncoming =
    fr?.status === "PENDING" && fr.senderId === targetId;

  return {
    isSelf: false,
    isFollowing: !!outFollow,
    followsMe: !!inFollow,
    isFriend,
    friendRequestOutgoing,
    friendRequestIncoming,
    blockedByMe,
    // Messaging policy mirrors what the web app gates on: friends can
    // always DM; followers/following exchange can DM without a chat
    // request. The full chat-request flow lands with the Chat slice.
    canMessage: !blockedByMe && (isFriend || !!outFollow || !!inFollow),
  };
}
