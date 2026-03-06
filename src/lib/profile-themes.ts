export interface ProfileThemeColors {
  profileBgColor: string;
  profileTextColor: string;
  profileLinkColor: string;
  profileSecondaryColor: string;
  profileContainerColor: string;
}

export const THEME_COLOR_FIELDS = [
  "profileBgColor",
  "profileTextColor",
  "profileLinkColor",
  "profileSecondaryColor",
  "profileContainerColor",
] as const;

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
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}
