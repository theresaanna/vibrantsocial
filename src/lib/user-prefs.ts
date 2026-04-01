import { prisma } from "@/lib/prisma";
import { cached, invalidate, cacheKeys } from "@/lib/cache";

export interface UserPrefs {
  showNsfwContent: boolean;
  ageVerified: boolean;
  hideWallFromFeed: boolean;
}

const DEFAULT_PREFS: UserPrefs = { showNsfwContent: false, ageVerified: false, hideWallFromFeed: false };

/**
 * Get user content preferences (NSFW opt-in, age verification).
 * Cached for 5 minutes since these change very rarely.
 */
export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  return cached(
    cacheKeys.userPrefs(userId),
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { showNsfwContent: true, ageVerified: true, hideWallFromFeed: true },
      });
      if (!user) return DEFAULT_PREFS;
      return {
        showNsfwContent: user.showNsfwContent ?? false,
        ageVerified: !!user.ageVerified,
        hideWallFromFeed: user.hideWallFromFeed ?? false,
      };
    },
    300 // 5 minutes
  );
}

/** Call when user changes NSFW or age verification settings. */
export async function invalidateUserPrefs(userId: string) {
  await invalidate(cacheKeys.userPrefs(userId));
}
