/**
 * Bulk theme update for the Flutter client. Mirrors the web
 * `updateTheme` server action but accepts JSON instead of FormData so
 * the mobile client can PATCH individual slices without having to
 * re-send the whole form each time.
 *
 * POST /api/v1/theme/update
 *   {
 *     profileBgColor?: string | null,
 *     profileTextColor?: string | null,
 *     profileLinkColor?: string | null,
 *     profileSecondaryColor?: string | null,
 *     profileContainerColor?: string | null,
 *     usernameFont?: string | null,
 *     profileBgImage?: string | null,
 *     profileBgRepeat?: string | null,
 *     profileBgAttachment?: string | null,
 *     profileBgSize?: string | null,
 *     profileBgPosition?: string | null,
 *     profileContainerOpacity?: number,          // 80–100
 *     sparklefallEnabled?: boolean,
 *     sparklefallPreset?: string | null,
 *     sparklefallSparkles?: string | null,       // JSON array string
 *     sparklefallColors?: string | null,         // JSON array string
 *     sparklefallInterval?: number,
 *     sparklefallWind?: number,
 *     sparklefallMaxSparkles?: number,
 *     sparklefallMinSize?: number,
 *     sparklefallMaxSize?: number,
 *   }
 *
 * Undefined keys are left untouched; explicit `null` clears the field.
 * Premium-gated fields (custom colors on non-free backgrounds, premium
 * fonts, sparklefall customization, premium background uploads) are
 * silently dropped for free users — same behavior as the web action.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { checkAndExpirePremium } from "@/lib/premium";
import { isValidHexColor, THEME_COLOR_FIELDS } from "@/lib/profile-themes";
import { isValidFontId, getFontById } from "@/lib/profile-fonts";
import {
  isValidBgRepeat,
  isValidBgAttachment,
  isValidBgSize,
  isValidBgPosition,
} from "@/lib/profile-backgrounds";
import {
  isPresetBackgroundSrc,
  isPremiumBackgroundSrc,
} from "@/lib/profile-backgrounds.server";
import { isValidPreset, parseJsonArray, clamp } from "@/lib/sparklefall-presets";
import { invalidate, cacheKeys } from "@/lib/cache";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;

  if (await isRateLimited(apiLimiter, `theme:${userId}`)) {
    return corsJson(req, { error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const isPremium = await checkAndExpirePremium(userId);
  const data: Record<string, unknown> = {};

  // ── colors ──────────────────────────────────────────────────────
  // Non-premium can save custom colors only when on a free preset bg.
  const bgForColorCheck =
    typeof body.profileBgImage === "string" ? body.profileBgImage.trim() : null;
  const hasFreePresetBg = bgForColorCheck
    ? isPresetBackgroundSrc(bgForColorCheck) &&
      !isPremiumBackgroundSrc(bgForColorCheck)
    : false;
  const canSetColors = isPremium || hasFreePresetBg;
  for (const field of THEME_COLOR_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null) {
      data[field] = null;
    } else if (typeof value === "string" && value.trim() !== "") {
      if (!isValidHexColor(value.trim())) {
        return corsJson(
          req,
          { error: `Invalid color for ${field}` },
          { status: 400 },
        );
      }
      data[field] = canSetColors ? value.trim() : null;
    } else {
      data[field] = null;
    }
  }

  // ── username font ───────────────────────────────────────────────
  if ("usernameFont" in body) {
    const raw = body.usernameFont;
    if (raw === null) {
      data.usernameFont = null;
    } else if (typeof raw === "string" && raw.trim()) {
      const id = raw.trim();
      if (!isValidFontId(id)) {
        return corsJson(req, { error: "Invalid font" }, { status: 400 });
      }
      const font = getFontById(id);
      data.usernameFont =
        font && font.tier === "premium" && !isPremium ? null : id;
    } else {
      data.usernameFont = null;
    }
  }

  // ── background image + geometry ─────────────────────────────────
  if ("profileBgImage" in body) {
    const raw = typeof body.profileBgImage === "string"
      ? body.profileBgImage.trim()
      : null;
    if (!raw) {
      // Clearing the background also resets the geometry fields.
      data.profileBgImage = null;
      data.profileBgRepeat = null;
      data.profileBgAttachment = null;
      data.profileBgSize = null;
      data.profileBgPosition = null;
    } else {
      const isPreset = isPresetBackgroundSrc(raw);
      const isPremiumPreset = isPremiumBackgroundSrc(raw);
      const isBlobUrl = raw.includes("blob.vercel-storage.com");
      if (!isPreset && !isBlobUrl) {
        return corsJson(req, { error: "Invalid background" }, { status: 400 });
      }
      // Free users can't pick premium presets, can't use blob uploads.
      if (!isPremium && (isPremiumPreset || isBlobUrl)) {
        return corsJson(req, { error: "Premium required" }, { status: 403 });
      }
      data.profileBgImage = raw;

      const setIfValid = (
        key: "profileBgRepeat" | "profileBgAttachment" | "profileBgSize" | "profileBgPosition",
        validator: (v: string) => boolean,
      ) => {
        if (!(key in body)) return;
        const v = body[key];
        if (v === null) {
          data[key] = null;
          return;
        }
        if (typeof v === "string" && v.trim()) {
          if (!validator(v.trim())) {
            throw new Error(`Invalid ${key}`);
          }
          data[key] = v.trim();
        } else {
          data[key] = null;
        }
      };
      try {
        setIfValid("profileBgRepeat", isValidBgRepeat);
        setIfValid("profileBgAttachment", isValidBgAttachment);
        setIfValid("profileBgSize", isValidBgSize);
        setIfValid("profileBgPosition", isValidBgPosition);
      } catch (err) {
        return corsJson(
          req,
          { error: err instanceof Error ? err.message : "Invalid geometry" },
          { status: 400 },
        );
      }
    }
  }

  // ── container opacity (available to all) ────────────────────────
  if ("profileContainerOpacity" in body) {
    const n = Number(body.profileContainerOpacity);
    if (Number.isFinite(n)) {
      data.profileContainerOpacity = clamp(Math.round(n), 80, 100);
    }
  }

  // ── sparklefall ────────────────────────────────────────────────
  if ("sparklefallEnabled" in body) {
    const enabled = body.sparklefallEnabled === true;
    if (!enabled) {
      data.sparklefallEnabled = false;
      data.sparklefallPreset = null;
      data.sparklefallSparkles = null;
      data.sparklefallColors = null;
      data.sparklefallInterval = null;
      data.sparklefallWind = null;
      data.sparklefallMaxSparkles = null;
      data.sparklefallMinSize = null;
      data.sparklefallMaxSize = null;
    } else if (isPremium) {
      data.sparklefallEnabled = true;
      if ("sparklefallPreset" in body) {
        const v = body.sparklefallPreset;
        if (v === null) data.sparklefallPreset = null;
        else if (typeof v === "string" && isValidPreset(v.trim()))
          data.sparklefallPreset = v.trim();
      }
      if ("sparklefallSparkles" in body) {
        const v = body.sparklefallSparkles;
        if (v === null) data.sparklefallSparkles = null;
        else if (typeof v === "string" && parseJsonArray(v))
          data.sparklefallSparkles = v;
      }
      if ("sparklefallColors" in body) {
        const v = body.sparklefallColors;
        if (v === null) data.sparklefallColors = null;
        else if (typeof v === "string" && parseJsonArray(v))
          data.sparklefallColors = v;
      }
      if ("sparklefallInterval" in body) {
        const n = Number(body.sparklefallInterval);
        if (Number.isFinite(n)) data.sparklefallInterval = clamp(n, 100, 3000);
      }
      if ("sparklefallWind" in body) {
        const n = Number(body.sparklefallWind);
        if (Number.isFinite(n)) data.sparklefallWind = clamp(n, -1, 1);
      }
      if ("sparklefallMaxSparkles" in body) {
        const n = Number(body.sparklefallMaxSparkles);
        if (Number.isFinite(n))
          data.sparklefallMaxSparkles = clamp(n, 5, 200);
      }
      if ("sparklefallMinSize" in body) {
        const n = Number(body.sparklefallMinSize);
        if (Number.isFinite(n)) data.sparklefallMinSize = clamp(n, 5, 100);
      }
      if ("sparklefallMaxSize" in body) {
        const n = Number(body.sparklefallMaxSize);
        if (Number.isFinite(n)) data.sparklefallMaxSize = clamp(n, 5, 100);
      }
    } else {
      // Non-premium: allow `default` preset only.
      data.sparklefallEnabled = true;
      data.sparklefallPreset = "default";
      data.sparklefallSparkles = null;
      data.sparklefallColors = null;
      data.sparklefallInterval = null;
      data.sparklefallWind = null;
      data.sparklefallMaxSparkles = null;
      data.sparklefallMinSize = null;
      data.sparklefallMaxSize = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return corsJson(req, { ok: true, noop: true });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { username: true },
  });

  if (user.username) {
    await invalidate(cacheKeys.userProfile(user.username));
  }

  return corsJson(req, { ok: true });
}
