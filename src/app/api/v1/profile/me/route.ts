/**
 * Current viewer's editable profile — the payload the Flutter
 * edit-profile screen hydrates itself from on GET, and submits patches
 * to on PUT.
 *
 * Intentionally does NOT expose or accept the NSFW / graphic / sensitive
 * overlay prefs (`showNsfwContent`, `showGraphicByDefault`,
 * `hideSensitiveOverlay`, `hideNsfwOverlay`). Play policy: those are
 * web-only. The underlying `updateMobileProfile` action also refuses to
 * write them.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { updateMobileProfile } from "@/app/profile/actions";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      bio: true,
      tier: true,
      profileFrameId: true,
      usernameFont: true,
      birthdayMonth: true,
      birthdayDay: true,
      isProfilePublic: true,
      hideWallFromFeed: true,
      pushEnabled: true,
      emailOnComment: true,
      emailOnNewChat: true,
      emailOnMention: true,
      emailOnFriendRequest: true,
      emailOnListJoinRequest: true,
      emailOnSubscribedPost: true,
      emailOnSubscribedComment: true,
      emailOnTagPost: true,
      email: true,
      phoneNumber: true,
      phoneVerified: true,
      twoFactorEnabled: true,
      suspended: true,
    },
  });

  if (!user) {
    return corsJson(req, { error: "Not found" }, { status: 404 });
  }

  // Web stores the bio as a Lexical JSON string. Flutter's bio field
  // is a plain-text `TextField`, so hand it the extracted text — the
  // rich formatting only survives on the web.
  const bioPlain = user.bio ? extractTextFromLexicalJson(user.bio) : null;

  return corsJson(req, {
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: bioPlain,
      tier: user.tier,
      profileFrameId: user.profileFrameId,
      usernameFont: user.usernameFont,
      birthdayMonth: user.birthdayMonth,
      birthdayDay: user.birthdayDay,
      isProfilePublic: user.isProfilePublic,
      hideWallFromFeed: user.hideWallFromFeed,
      pushEnabled: user.pushEnabled,
      emailOnComment: user.emailOnComment,
      emailOnNewChat: user.emailOnNewChat,
      emailOnMention: user.emailOnMention,
      emailOnFriendRequest: user.emailOnFriendRequest,
      emailOnListJoinRequest: user.emailOnListJoinRequest,
      emailOnSubscribedPost: user.emailOnSubscribedPost,
      emailOnSubscribedComment: user.emailOnSubscribedComment,
      emailOnTagPost: user.emailOnTagPost,
      // Read-only context for the mobile UI — shown as "manage on web"
      // entry points. These fields are never writable through this
      // route.
      email: user.email,
      emailVerified: Boolean(user.email),
      phoneNumber: user.phoneNumber,
      phoneVerified: user.phoneVerified !== null,
      twoFactorEnabled: user.twoFactorEnabled,
      suspended: user.suspended,
    },
  });
}

// Allow-list of keys the mobile client is allowed to PUT, split by the
// expected wire type. Any key outside these lists is silently dropped —
// prevents NSFW pref leakage via this endpoint and keeps `updateMobile-
// Profile` from seeing unexpected keys.
const STRING_KEYS = ["username", "displayName", "bio", "profileFrameId"] as const;
const NUMBER_KEYS = ["birthdayMonth", "birthdayDay"] as const;
const BOOLEAN_KEYS = [
  "isProfilePublic",
  "hideWallFromFeed",
  "pushEnabled",
  "emailOnComment",
  "emailOnNewChat",
  "emailOnMention",
  "emailOnFriendRequest",
  "emailOnListJoinRequest",
  "emailOnSubscribedPost",
  "emailOnSubscribedComment",
  "emailOnTagPost",
] as const;

export async function PUT(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return corsJson(req, { error: "Invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  // Build a strictly-typed patch. `null` is an explicit "clear this
  // field" signal for the string and number columns; booleans don't
  // accept null.
  const patch: Parameters<typeof updateMobileProfile>[0] = {};
  for (const k of STRING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (v === null || typeof v === "string") {
      (patch as Record<string, unknown>)[k] = v;
    } else {
      return corsJson(req, { error: `${k} must be a string or null` }, { status: 400 });
    }
  }
  for (const k of NUMBER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (v === null || (typeof v === "number" && Number.isInteger(v))) {
      (patch as Record<string, unknown>)[k] = v;
    } else {
      return corsJson(req, { error: `${k} must be an integer or null` }, { status: 400 });
    }
  }
  for (const k of BOOLEAN_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (typeof v === "boolean") {
      (patch as Record<string, unknown>)[k] = v;
    } else {
      return corsJson(req, { error: `${k} must be a boolean` }, { status: 400 });
    }
  }

  const result = await updateMobileProfile(patch);
  if (!result.success) {
    return corsJson(req, { error: result.message }, { status: 400 });
  }
  return corsJson(req, { ok: true, message: result.message });
}
