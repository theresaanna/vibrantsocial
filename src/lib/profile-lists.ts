import { prisma } from "@/lib/prisma";
import { getFontById } from "@/lib/profile-fonts";
import { getFrameById } from "@/lib/profile-frames";
import { toAbsolute } from "@/lib/theme-resolver";

export const PAGE_SIZE = 30;

export interface UserListEntry {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  tier: string;
  verified: boolean;
  /** Google-fonts family id for the user's chosen username font, if any. */
  usernameFontFamily: string | null;
  /** Avatar frame overlay metadata, null when the user hasn't picked one. */
  frame: SerializedAvatarFrame | null;
  isFollowing: boolean;
  isFriend: boolean;
  isSelf: boolean;
}

export interface SerializedAvatarFrame {
  id: string;
  imageUrl: string;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  frameScale: number;
}

/**
 * Resolve a stored `profileFrameId` into the fully-qualified metadata
 * the mobile client needs to render the overlay. Returns null for
 * unknown / absent frame ids.
 */
export function resolveAvatarFrame(
  frameId: string | null,
  assetBaseUrl: string,
): SerializedAvatarFrame | null {
  const frame = getFrameById(frameId ?? null);
  if (!frame) return null;
  return {
    id: frame.id,
    imageUrl: toAbsolute(frame.src, assetBaseUrl),
    scaleX: frame.scaleX ?? 1,
    scaleY: frame.scaleY ?? 1,
    offsetX: frame.offsetX ?? 0,
    offsetY: frame.offsetY ?? 0,
    frameScale: frame.frameScale ?? 1,
  };
}

export interface UserListPage {
  users: UserListEntry[];
  nextCursor: string | null;
}

interface RawUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  tier: string | null;
  emailVerified: Date | null;
  usernameFont: string | null;
  profileFrameId: string | null;
}

export const userListSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
  tier: true,
  emailVerified: true,
  usernameFont: true,
  profileFrameId: true,
} as const;

/**
 * Enrich a raw user row set with viewer-relative flags in one batch query
 * per relation type. Follows and friend requests are looked up together so
 * the list can render mini action buttons without per-row round-trips.
 */
export async function annotateUserEntries(
  viewerId: string | null,
  rawUsers: RawUser[],
  assetBaseUrl: string,
): Promise<UserListEntry[]> {
  if (rawUsers.length === 0) return [];
  const ids = rawUsers.map((u) => u.id);
  const followingSet = new Set<string>();
  const friendSet = new Set<string>();

  if (viewerId) {
    const [follows, friendships] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: ids } },
        select: { followingId: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: viewerId, receiverId: { in: ids } },
            { receiverId: viewerId, senderId: { in: ids } },
          ],
        },
        select: { senderId: true, receiverId: true },
      }),
    ]);
    for (const f of follows) followingSet.add(f.followingId);
    for (const fr of friendships) {
      friendSet.add(fr.senderId === viewerId ? fr.receiverId : fr.senderId);
    }
  }

  return rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    name: u.name,
    avatar: u.avatar ?? u.image,
    tier: u.tier ?? "free",
    verified: u.emailVerified != null,
    usernameFontFamily: resolveFontFamily(u.usernameFont, u.tier),
    frame: resolveAvatarFrame(u.profileFrameId, assetBaseUrl),
    isFollowing: followingSet.has(u.id),
    isFriend: friendSet.has(u.id),
    isSelf: viewerId === u.id,
  }));
}

/**
 * Look up a profile target by username and return its id, plus whether
 * the viewer is blocked by the target (so the caller can 404 before
 * returning list data).
 */
export async function resolveTarget(
  username: string,
  viewerId: string | null,
): Promise<{ targetId: string } | null> {
  const target = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, suspended: true },
  });
  if (!target || target.suspended) return null;
  if (viewerId && viewerId !== target.id) {
    const blocked = await prisma.block.findFirst({
      where: {
        blockerId: target.id,
        blockedId: viewerId,
      },
      select: { id: true },
    });
    if (blocked) return null;
  }
  return { targetId: target.id };
}

/**
 * Parse the optional `cursor` query param — a relationship-table row id.
 * Returns undefined when absent so Prisma skips cursor pagination.
 */
export function parseCursor(req: Request): string | undefined {
  const raw = new URL(req.url).searchParams.get("cursor");
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Public-facing origin the caller reached us through. `req.url` can
 * normalize to localhost in dev, so we prefer the forwarded/host header
 * pair — mobile clients on Android emulators hit us via `10.0.2.2`.
 */
export function resolveAssetBaseUrl(req: Request): string {
  const headers = req.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto =
    headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

/**
 * Resolve a stored font id into the Google-fonts family name the mobile
 * client should render the username in. Premium fonts only apply to
 * premium accounts — mirrors the web gate on font selection.
 */
export function resolveFontFamily(
  fontId: string | null,
  tier: string | null,
): string | null {
  const def = getFontById(fontId ?? null);
  if (!def) return null;
  if (def.tier === "premium" && tier !== "premium") return null;
  return def.googleFamily.replaceAll("+", " ");
}

/**
 * Where-clause fragment that hides users the viewer has blocked or who
 * have blocked the viewer. Nested under the relation field (e.g.
 * `follower`, `sender`, `receiver`) that names the user being listed.
 */
export function hideBlockedClause(
  viewerId: string | null,
  relationField: string,
) {
  if (!viewerId) return {};
  return {
    [relationField]: {
      AND: [
        { blockedUsers: { none: { blockedId: viewerId } } },
        { blockedBy: { none: { blockerId: viewerId } } },
      ],
    },
  };
}
