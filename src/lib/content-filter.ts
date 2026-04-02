/**
 * Shared content-flag filter builders for Prisma queries.
 *
 * Rules:
 * 1. NSFW off → all flagged posts filtered from feeds (only visible on
 *    poster's profile special tabs with overlays).
 * 2. NSFW on → NSFW posts appear in feeds with overlay. Sensitive &
 *    graphic still filtered unless age verified AND overlay is turned off.
 * 3. NSFW on + age verified + overlay off for a type → that type appears
 *    in feeds (without overlay). NSFW always appears (with overlay unless
 *    hideNsfwOverlay is on).
 * 4. NSFW off + overlays toggled off → ignore overlay toggles; filter
 *    everything from feeds.
 *
 * Age verification is ALWAYS required for sensitive and graphic content,
 * regardless of other settings.
 */

export interface ContentFilterPrefs {
  showNsfwContent: boolean;
  ageVerified: boolean;
  hideSensitiveOverlay: boolean;
  showGraphicByDefault: boolean;
}

/**
 * Build a Prisma `where` clause fragment for feed queries (following,
 * for-you, close-friends, lists, discussions, media tabs).
 *
 * Sensitive and graphic posts only appear when NSFW is on AND the user
 * is age-verified AND has opted to remove the overlay for that category.
 */
export function buildFeedContentFilter(prefs: ContentFilterPrefs) {
  return {
    ...(!prefs.showNsfwContent ? { isNsfw: false } : {}),
    ...(!prefs.showNsfwContent || !prefs.ageVerified || !prefs.hideSensitiveOverlay
      ? { isSensitive: false }
      : {}),
    ...(!prefs.showNsfwContent || !prefs.ageVerified || !prefs.showGraphicByDefault
      ? { isGraphicNudity: false }
      : {}),
  };
}

/**
 * Build a Prisma `where` clause fragment for media-tab queries
 * (profile media and feed media). Same rules as feeds.
 */
export function buildMediaContentFilter(prefs: ContentFilterPrefs) {
  return buildFeedContentFilter(prefs);
}

/**
 * Build a filter for logged-out users — hide everything flagged.
 */
export function buildLoggedOutContentFilter() {
  return {
    isSensitive: false,
    isNsfw: false,
    isGraphicNudity: false,
    isLoggedInOnly: false,
  };
}
