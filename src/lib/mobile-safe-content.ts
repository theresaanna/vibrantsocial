/**
 * Hard content filter for the Play-Store distribution of the mobile app.
 *
 * Google Play's sexual-content policy bans apps that contain or
 * promote explicit content even when age-gated behind toggles. To
 * stay within policy we never serve posts tagged `isNsfw`,
 * `isSensitive`, or `isGraphicNudity` to mobile API clients — the
 * viewer's per-account preferences are deliberately ignored on /api/v1.
 *
 * Web users still get the full per-pref experience via the existing
 * server actions and React-rendered feed routes; only the /api/v1
 * routes consumed by the Flutter app are locked down here.
 */

/**
 * Prisma `where` fragment to merge into any Post query served by
 * /api/v1. Spread it alongside your existing conditions:
 *
 *   const rows = await prisma.post.findMany({
 *     where: { ...mobileSafePostFilter, ...otherFilters },
 *     ...
 *   });
 */
export const mobileSafePostFilter = {
  isNsfw: false,
  isSensitive: false,
  isGraphicNudity: false,
} as const;

/**
 * True when an individual post is safe to show on mobile. Use for
 * detail endpoints that look up one post — if this returns false the
 * endpoint should 404.
 */
export function isMobileSafePost(post: {
  isNsfw: boolean;
  isSensitive?: boolean | null;
  isGraphicNudity?: boolean | null;
}): boolean {
  return !post.isNsfw && !post.isSensitive && !post.isGraphicNudity;
}
