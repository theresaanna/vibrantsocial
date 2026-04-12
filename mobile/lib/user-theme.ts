/**
 * Mobile port of the web's user-theme system.
 * Defines theme types, built-in presets, and style helpers for React Native.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ProfileThemeColors {
  profileBgColor: string;
  profileTextColor: string;
  profileLinkColor: string;
  profileSecondaryColor: string;
  profileContainerColor: string;
}

export interface UserThemeData {
  id: string;
  tier: string | null;
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
  sparklefallEnabled: boolean;
  sparklefallPreset: string | null;
}

export interface UserThemeColors {
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  secondaryColor: string;
  containerColor: string;
  containerOpacity: number;
  bgImageUrl: string | null;
}

export const DEFAULT_THEME_COLORS: UserThemeColors = {
  backgroundColor: "#ffffff",
  textColor: "#18181b",
  linkColor: "#2563eb",
  secondaryColor: "#71717a",
  containerColor: "#f4f4f5",
  containerOpacity: 100,
  bgImageUrl: null,
};

// ── Theme Color Fields ──────────────────────────────────────────────

export const THEME_COLOR_FIELDS = [
  "profileBgColor",
  "profileTextColor",
  "profileLinkColor",
  "profileSecondaryColor",
  "profileContainerColor",
] as const;

// ── Built-in Presets ────────────────────────────────────────────────

export const PROFILE_THEME_PRESETS: Record<string, ProfileThemeColors> = {
  default: {
    profileBgColor: "#ffffff",
    profileTextColor: "#18181b",
    profileLinkColor: "#2563eb",
    profileSecondaryColor: "#71717a",
    profileContainerColor: "#f4f4f5",
  },
  ocean: {
    profileBgColor: "#0c1929",
    profileTextColor: "#e0f2fe",
    profileLinkColor: "#38bdf8",
    profileSecondaryColor: "#7dd3fc",
    profileContainerColor: "#172a45",
  },
  forest: {
    profileBgColor: "#0f1f0f",
    profileTextColor: "#dcfce7",
    profileLinkColor: "#4ade80",
    profileSecondaryColor: "#86efac",
    profileContainerColor: "#1a3a1a",
  },
  sunset: {
    profileBgColor: "#1c0f0a",
    profileTextColor: "#fef3c7",
    profileLinkColor: "#fb923c",
    profileSecondaryColor: "#fdba74",
    profileContainerColor: "#2d1810",
  },
  midnight: {
    profileBgColor: "#0f0720",
    profileTextColor: "#e9d5ff",
    profileLinkColor: "#a78bfa",
    profileSecondaryColor: "#c4b5fd",
    profileContainerColor: "#1a0e35",
  },
  rose: {
    profileBgColor: "#fdf2f8",
    profileTextColor: "#1c1917",
    profileLinkColor: "#e11d48",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#fce7f3",
  },
  lavender: {
    profileBgColor: "#faf5ff",
    profileTextColor: "#1c1917",
    profileLinkColor: "#7c3aed",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#f3e8ff",
  },
  sky: {
    profileBgColor: "#f0f9ff",
    profileTextColor: "#1c1917",
    profileLinkColor: "#0284c7",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#e0f2fe",
  },
  mint: {
    profileBgColor: "#f0fdfa",
    profileTextColor: "#1c1917",
    profileLinkColor: "#0d9488",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#ccfbf1",
  },
  peach: {
    profileBgColor: "#fef7ee",
    profileTextColor: "#1c1917",
    profileLinkColor: "#ea580c",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#fed7aa",
  },
  terracotta: {
    profileBgColor: "#1a0e0a",
    profileTextColor: "#fde8d8",
    profileLinkColor: "#e87c5a",
    profileSecondaryColor: "#d4a088",
    profileContainerColor: "#2d1a12",
  },
  amber: {
    profileBgColor: "#fffbeb",
    profileTextColor: "#1c1917",
    profileLinkColor: "#d97706",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#fde68a",
  },
  cinnamon: {
    profileBgColor: "#fdf4f0",
    profileTextColor: "#1c1917",
    profileLinkColor: "#b45309",
    profileSecondaryColor: "#a8a29e",
    profileContainerColor: "#f5ddd3",
  },
  stone: {
    profileBgColor: "#f5f5f4",
    profileTextColor: "#1c1917",
    profileLinkColor: "#78716c",
    profileSecondaryColor: "#a8a29e",
    profileContainerColor: "#e7e5e4",
  },
  slate: {
    profileBgColor: "#f8fafc",
    profileTextColor: "#0f172a",
    profileLinkColor: "#475569",
    profileSecondaryColor: "#94a3b8",
    profileContainerColor: "#f1f5f9",
  },
  sand: {
    profileBgColor: "#fefce8",
    profileTextColor: "#1c1917",
    profileLinkColor: "#a16207",
    profileSecondaryColor: "#a3a3a3",
    profileContainerColor: "#fef9c3",
  },
  charcoal: {
    profileBgColor: "#18181b",
    profileTextColor: "#e4e4e7",
    profileLinkColor: "#a1a1aa",
    profileSecondaryColor: "#71717a",
    profileContainerColor: "#27272a",
  },
  ash: {
    profileBgColor: "#f4f4f5",
    profileTextColor: "#27272a",
    profileLinkColor: "#52525b",
    profileSecondaryColor: "#a1a1aa",
    profileContainerColor: "#e4e4e7",
  },
  graphite: {
    profileBgColor: "#111827",
    profileTextColor: "#e5e7eb",
    profileLinkColor: "#9ca3af",
    profileSecondaryColor: "#6b7280",
    profileContainerColor: "#1f2937",
  },
};

// ── Style Builders ──────────────────────────────────────────────────

/**
 * Extracts native theme colors from a UserThemeData object.
 * Returns a flat object suitable for React Native style props.
 */
export function getThemeStyles(themeData: Partial<UserThemeData> | null | undefined): UserThemeColors {
  if (!themeData) return { ...DEFAULT_THEME_COLORS };

  return {
    backgroundColor: themeData.profileBgColor ?? DEFAULT_THEME_COLORS.backgroundColor,
    textColor: themeData.profileTextColor ?? DEFAULT_THEME_COLORS.textColor,
    linkColor: themeData.profileLinkColor ?? DEFAULT_THEME_COLORS.linkColor,
    secondaryColor: themeData.profileSecondaryColor ?? DEFAULT_THEME_COLORS.secondaryColor,
    containerColor: themeData.profileContainerColor ?? DEFAULT_THEME_COLORS.containerColor,
    containerOpacity: themeData.profileContainerOpacity ?? DEFAULT_THEME_COLORS.containerOpacity,
    bgImageUrl: themeData.profileBgImage ?? null,
  };
}

/**
 * Returns true if the given theme data has any custom color set.
 */
export function hasCustomTheme(themeData: Partial<UserThemeData> | null | undefined): boolean {
  if (!themeData) return false;
  return !!(
    themeData.profileBgColor ||
    themeData.profileTextColor ||
    themeData.profileLinkColor ||
    themeData.profileSecondaryColor ||
    themeData.profileContainerColor
  );
}

/**
 * Converts a hex color + opacity (80-100) into an rgba string.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/**
 * Checks if a hex color string is valid.
 */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://www.vibrantsocial.app";

/**
 * Resolve a potentially relative image path (e.g. /backgrounds/foo.jpg)
 * to an absolute URL for use in React Native Image components.
 */
export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}

/**
 * Convert ProfileThemeColors to UserThemeColors for display purposes.
 */
export function presetToThemeColors(preset: ProfileThemeColors): UserThemeColors {
  return {
    backgroundColor: preset.profileBgColor,
    textColor: preset.profileTextColor,
    linkColor: preset.profileLinkColor,
    secondaryColor: preset.profileSecondaryColor,
    containerColor: preset.profileContainerColor,
    containerOpacity: 100,
    bgImageUrl: null,
  };
}
