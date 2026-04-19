/**
 * Theme picker catalog — the static data the mobile client needs to
 * render the Appearance screen without guessing.
 *
 * GET /api/v1/theme/options
 *   → {
 *       backgrounds: [ { id, name, src, thumbSrc, category, premiumOnly } ],
 *       fonts:       [ { id, name, googleFamily, tier } ],
 *       sparklefallPresets: [ { id, label, emoji, sparkles } ],
 *       viewerIsPremium: boolean,
 *     }
 *
 * Server-absolute URLs are returned so image widgets don't have to
 * concatenate the API base URL themselves.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { getAllProfileBackgrounds } from "@/lib/profile-backgrounds.server";
import { resolveAssetBaseUrl } from "@/lib/profile-lists";
import { USERNAME_FONTS } from "@/lib/profile-fonts";
import { SPARKLEFALL_PRESETS } from "@/lib/sparklefall-presets";
import { checkAndExpirePremium } from "@/lib/premium";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const base = resolveAssetBaseUrl(req);
  const backgrounds = getAllProfileBackgrounds().map((b) => ({
    id: b.id,
    name: b.name,
    src: `${base}${b.src}`,
    thumbSrc: `${base}${b.thumbSrc}`,
    category: b.category,
    premiumOnly: b.premiumOnly === true,
  }));

  const fonts = USERNAME_FONTS.map((f) => ({
    id: f.id,
    name: f.name,
    googleFamily: f.googleFamily,
    tier: f.tier,
  }));

  const sparklefallPresets = Object.entries(SPARKLEFALL_PRESETS).map(
    ([id, p]) => ({
      id,
      label: p.label,
      emoji: p.emoji,
      sparkles: p.sparkles,
    }),
  );

  const viewerIsPremium = await checkAndExpirePremium(viewer.userId);

  // Current theme state so the editor prefills the user's existing
  // selections on open. Raw nullable columns — no resolver defaults.
  const current = await prisma.user.findUniqueOrThrow({
    where: { id: viewer.userId },
    select: {
      profileBgColor: true,
      profileTextColor: true,
      profileLinkColor: true,
      profileSecondaryColor: true,
      profileContainerColor: true,
      profileContainerOpacity: true,
      profileBgImage: true,
      profileBgRepeat: true,
      profileBgAttachment: true,
      profileBgSize: true,
      profileBgPosition: true,
      usernameFont: true,
      sparklefallEnabled: true,
      sparklefallPreset: true,
      sparklefallSparkles: true,
      sparklefallColors: true,
      sparklefallInterval: true,
      sparklefallWind: true,
      sparklefallMaxSparkles: true,
      sparklefallMinSize: true,
      sparklefallMaxSize: true,
    },
  });

  return corsJson(req, {
    backgrounds,
    fonts,
    sparklefallPresets,
    viewerIsPremium,
    current,
  });
}
