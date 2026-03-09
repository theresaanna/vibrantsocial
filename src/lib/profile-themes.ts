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
  // Light themes
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
  // Neutral themes
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
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

// --- Color utility functions ---

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }

  return { h: h * 360, s, l };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightBackground(hex: string): boolean {
  return relativeLuminance(hex) > 0.18;
}

function invertLightness(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const newL = 1.0 - l;
  const rgb = hslToRgb(h, s, newL);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function adjustForContrast(
  fgHex: string,
  bgHex: string,
  minRatio: number
): string {
  if (contrastRatio(fgHex, bgHex) >= minRatio) {
    return fgHex;
  }

  const bgLum = relativeLuminance(bgHex);
  const { r, g, b } = hexToRgb(fgHex);
  const { h, s } = rgbToHsl(r, g, b);

  // Determine direction: if bg is dark, lighten fg; if bg is light, darken fg
  const goLighter = bgLum < 0.5;

  let bestL = goLighter ? 0.95 : 0.05;
  // Binary-search for the minimum adjustment that meets the ratio
  let lo = goLighter ? 0.5 : 0.0;
  let hi = goLighter ? 1.0 : 0.5;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const rgb = hslToRgb(h, s, mid);
    const candidate = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (contrastRatio(candidate, bgHex) >= minRatio) {
      bestL = mid;
      if (goLighter) {
        hi = mid; // try less lightening
      } else {
        lo = mid; // try less darkening
      }
    } else {
      if (goLighter) {
        lo = mid; // need more lightening
      } else {
        hi = mid; // need more darkening
      }
    }
  }

  const rgb2 = hslToRgb(h, s, bestL);
  return rgbToHex(rgb2.r, rgb2.g, rgb2.b);
}

export function generateAdaptiveTheme(colors: ProfileThemeColors): {
  light: ProfileThemeColors;
  dark: ProfileThemeColors;
} {
  const isLight = isLightBackground(colors.profileBgColor);

  // Generate the opposite palette
  let genBg = invertLightness(colors.profileBgColor);
  let genContainer = invertLightness(colors.profileContainerColor);
  let genText = invertLightness(colors.profileTextColor);
  let genSecondary = invertLightness(colors.profileSecondaryColor);
  let genLink = invertLightness(colors.profileLinkColor);

  // Enforce contrast for text elements against generated background
  genText = adjustForContrast(genText, genBg, 4.5);
  genSecondary = adjustForContrast(genSecondary, genBg, 4.5);
  genLink = adjustForContrast(genLink, genBg, 4.5);

  // Ensure link is visually distinct from text
  const linkRgb = hexToRgb(genLink);
  const textRgb = hexToRgb(genText);
  const linkHsl = rgbToHsl(linkRgb.r, linkRgb.g, linkRgb.b);
  const textHsl = rgbToHsl(textRgb.r, textRgb.g, textRgb.b);
  const hueDiff = Math.abs(linkHsl.h - textHsl.h);
  const normalizedHueDiff = Math.min(hueDiff, 360 - hueDiff);
  if (normalizedHueDiff < 30 && Math.abs(linkHsl.l - textHsl.l) < 0.1) {
    const nudgedL = Math.min(0.95, Math.max(0.05, linkHsl.l + (isLight ? 0.15 : -0.15)));
    const nudged = hslToRgb(linkHsl.h, linkHsl.s, nudgedL);
    genLink = rgbToHex(nudged.r, nudged.g, nudged.b);
    genLink = adjustForContrast(genLink, genBg, 4.5);
  }

  // Ensure container has minimum offset from background
  const bgRgb = hexToRgb(genBg);
  const contRgb = hexToRgb(genContainer);
  const bgHsl = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b);
  const contHsl = rgbToHsl(contRgb.r, contRgb.g, contRgb.b);
  if (Math.abs(contHsl.l - bgHsl.l) < 0.05) {
    const offset = isLight ? -0.06 : 0.06;
    const adjustedL = Math.min(0.95, Math.max(0.05, contHsl.l + offset));
    const adjusted = hslToRgb(contHsl.h, contHsl.s, adjustedL);
    genContainer = rgbToHex(adjusted.r, adjusted.g, adjusted.b);
  }

  const generated: ProfileThemeColors = {
    profileBgColor: genBg,
    profileTextColor: genText,
    profileLinkColor: genLink,
    profileSecondaryColor: genSecondary,
    profileContainerColor: genContainer,
  };

  return isLight
    ? { light: colors, dark: generated }
    : { light: generated, dark: colors };
}
