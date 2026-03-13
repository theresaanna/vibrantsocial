/**
 * Build the content-flag filter for the profile "posts" tab query.
 *
 * - Logged-out users see no flagged content (handled by loggedOutFilter in page).
 * - Logged-in users: sensitive & graphic posts always go to their own tabs.
 * - NSFW posts are included on the posts tab when the viewer has opted in.
 */
export function buildProfilePostsContentFilter(
  currentUserId: string | undefined,
  showNsfwContent: boolean
) {
  if (!currentUserId) return {};
  return {
    isSensitive: false,
    ...(!showNsfwContent ? { isNsfw: false } : {}),
    isGraphicNudity: false,
  };
}
