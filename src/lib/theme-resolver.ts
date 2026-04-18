import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";
import { getFontById, getGoogleFontUrl } from "@/lib/profile-fonts";
import { getFrameById } from "@/lib/profile-frames";
import {
  SPARKLEFALL_PRESETS,
  SPARKLEFALL_DEFAULTS,
  parseJsonArray,
} from "@/lib/sparklefall-presets";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";
import {
  VALID_BG_REPEAT,
  VALID_BG_ATTACHMENT,
  VALID_BG_SIZE,
  VALID_BG_POSITION,
  type BgRepeat,
  type BgAttachment,
  type BgSize,
  type BgPosition,
} from "@/lib/profile-backgrounds";

export const THEME_VERSION = 1;

/**
 * Prisma select fragment covering every field consumed by `resolveUserTheme`.
 * Use this instead of hand-listing columns so the resolver and its callers
 * never drift.
 */
export const themeResolverUserSelect = {
  id: true,
  tier: true,
  premiumExpiresAt: true,
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
  profileFrameId: true,
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
  birthdayMonth: true,
  birthdayDay: true,
} as const;

export interface ThemeResolverUser {
  id: string;
  tier: string | null;
  premiumExpiresAt: Date | null;
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
  profileContainerOpacity: number | null;
  profileBgImage: string | null;
  profileBgRepeat: string | null;
  profileBgAttachment: string | null;
  profileBgSize: string | null;
  profileBgPosition: string | null;
  profileFrameId: string | null;
  usernameFont: string | null;
  sparklefallEnabled: boolean;
  sparklefallPreset: string | null;
  sparklefallSparkles: string | null;
  sparklefallColors: string | null;
  sparklefallInterval: number | null;
  sparklefallWind: number | null;
  sparklefallMaxSparkles: number | null;
  sparklefallMinSize: number | null;
  sparklefallMaxSize: number | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
}

export interface ResolvedColors {
  bg: string;
  text: string;
  link: string;
  secondary: string;
  container: string;
}

export interface ResolvedBackground {
  imageUrl: string;
  repeat: BgRepeat;
  attachment: BgAttachment;
  size: BgSize;
  position: BgPosition;
}

export interface ResolvedFont {
  id: string;
  name: string;
  googleFamily: string;
  tier: "free" | "premium";
  cssUrl: string;
}

export interface ResolvedFrame {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  frameScale: number;
}

export type SparklefallReason = "user" | "birthday";

export interface ResolvedSparklefall {
  enabled: true;
  presetId: string | null;
  sparkles: string[];
  colors: string[];
  interval: number;
  wind: number;
  maxSparkles: number;
  minSize: number;
  maxSize: number;
  reason: SparklefallReason;
}

export interface ResolvedUserTheme {
  version: typeof THEME_VERSION;
  hasCustomTheme: boolean;
  colors: ResolvedColors;
  container: { opacity: number };
  background: ResolvedBackground | null;
  font: ResolvedFont | null;
  frame: ResolvedFrame | null;
  sparklefall: ResolvedSparklefall | null;
}

export interface ResolveThemeOptions {
  /**
   * Absolute origin (e.g. "https://vibrantsocial.app") used to prefix
   * relative asset paths. Omit for same-origin callers (web); set for
   * cross-origin clients (mobile) that need fully-qualified URLs.
   */
  assetBaseUrl?: string;
  /**
   * Override "now" for birthday logic — used in tests.
   */
  now?: Date;
}

const DEFAULT_COLORS = PROFILE_THEME_PRESETS.default;

export function toAbsolute(assetPath: string, baseUrl: string | undefined): string {
  if (!baseUrl) return assetPath;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  const base = baseUrl.replace(/\/+$/, "");
  const rel = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return `${base}${rel}`;
}

function pickEnum<T extends readonly string[]>(
  allowed: T,
  value: string | null,
  fallback: T[number],
): T[number] {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

function isEffectivelyPremium(user: ThemeResolverUser, now: Date): boolean {
  if (user.tier !== "premium") return false;
  if (user.premiumExpiresAt === null) return true;
  return new Date(user.premiumExpiresAt) > now;
}

function resolveSparklefall(
  user: ThemeResolverUser,
  isPremium: boolean,
  now: Date,
): ResolvedSparklefall | null {
  // Birthday override wins regardless of premium or enabled state.
  if (isBirthday(user.birthdayMonth, user.birthdayDay, now)) {
    const bday = getBirthdaySparkleConfig();
    return {
      enabled: true,
      presetId: null,
      sparkles: parseJsonArray(bday.sparkles) ?? SPARKLEFALL_PRESETS.party.sparkles,
      colors: [],
      interval: bday.interval ?? SPARKLEFALL_DEFAULTS.interval,
      wind: bday.wind ?? SPARKLEFALL_DEFAULTS.wind,
      maxSparkles: bday.maxSparkles ?? SPARKLEFALL_DEFAULTS.maxSparkles,
      minSize: bday.minSize ?? SPARKLEFALL_DEFAULTS.minSize,
      maxSize: bday.maxSize ?? SPARKLEFALL_DEFAULTS.maxSize,
      reason: "birthday",
    };
  }

  if (!user.sparklefallEnabled || !isPremium) return null;

  const presetSparkles: string[] | null = user.sparklefallPreset
    ? SPARKLEFALL_PRESETS[user.sparklefallPreset]?.sparkles ?? null
    : null;
  const sparkles =
    parseJsonArray(user.sparklefallSparkles) ??
    presetSparkles ??
    SPARKLEFALL_PRESETS.default.sparkles;
  const colors = parseJsonArray(user.sparklefallColors) ?? [];

  return {
    enabled: true,
    presetId: user.sparklefallPreset,
    sparkles,
    colors,
    interval: user.sparklefallInterval ?? SPARKLEFALL_DEFAULTS.interval,
    wind: user.sparklefallWind ?? SPARKLEFALL_DEFAULTS.wind,
    maxSparkles: user.sparklefallMaxSparkles ?? SPARKLEFALL_DEFAULTS.maxSparkles,
    minSize: user.sparklefallMinSize ?? SPARKLEFALL_DEFAULTS.minSize,
    maxSize: user.sparklefallMaxSize ?? SPARKLEFALL_DEFAULTS.maxSize,
    reason: "user",
  };
}

/**
 * Resolve a user's stored theme columns into the platform-agnostic wire
 * format consumed by the web client and the mobile app. Pure function — no
 * I/O, no framework primitives, deterministic given the same inputs.
 *
 * Tier gating: sparklefall requires active premium; fonts/frames/backgrounds
 * are trusted as stored (write-time paths enforce premium gating when the
 * user changes their selection).
 */
export function resolveUserTheme(
  user: ThemeResolverUser,
  options: ResolveThemeOptions = {},
): ResolvedUserTheme {
  const { assetBaseUrl, now = new Date() } = options;
  const isPremium = isEffectivelyPremium(user, now);

  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const colors: ResolvedColors = {
    bg: user.profileBgColor ?? DEFAULT_COLORS.profileBgColor,
    text: user.profileTextColor ?? DEFAULT_COLORS.profileTextColor,
    link: user.profileLinkColor ?? DEFAULT_COLORS.profileLinkColor,
    secondary: user.profileSecondaryColor ?? DEFAULT_COLORS.profileSecondaryColor,
    container: user.profileContainerColor ?? DEFAULT_COLORS.profileContainerColor,
  };

  const container = { opacity: user.profileContainerOpacity ?? 100 };

  const background: ResolvedBackground | null = user.profileBgImage
    ? {
        imageUrl: toAbsolute(user.profileBgImage, assetBaseUrl),
        repeat: pickEnum(VALID_BG_REPEAT, user.profileBgRepeat, "no-repeat"),
        attachment: pickEnum(VALID_BG_ATTACHMENT, user.profileBgAttachment, "scroll"),
        size: pickEnum(VALID_BG_SIZE, user.profileBgSize, "100% 100%"),
        position: pickEnum(VALID_BG_POSITION, user.profileBgPosition, "center"),
      }
    : null;

  const fontDef = getFontById(user.usernameFont);
  const font: ResolvedFont | null = fontDef
    ? {
        id: fontDef.id,
        name: fontDef.name,
        googleFamily: fontDef.googleFamily,
        tier: fontDef.tier,
        cssUrl: getGoogleFontUrl(fontDef),
      }
    : null;

  const frameDef = getFrameById(user.profileFrameId);
  const frame: ResolvedFrame | null = frameDef
    ? {
        id: frameDef.id,
        name: frameDef.name,
        imageUrl: toAbsolute(frameDef.src, assetBaseUrl),
        category: frameDef.category,
        scaleX: frameDef.scaleX ?? 1,
        scaleY: frameDef.scaleY ?? 1,
        offsetX: frameDef.offsetX ?? 0,
        offsetY: frameDef.offsetY ?? 0,
        frameScale: frameDef.frameScale ?? 1,
      }
    : null;

  const sparklefall = resolveSparklefall(user, isPremium, now);

  return {
    version: THEME_VERSION,
    hasCustomTheme,
    colors,
    container,
    background,
    font,
    frame,
    sparklefall,
  };
}
