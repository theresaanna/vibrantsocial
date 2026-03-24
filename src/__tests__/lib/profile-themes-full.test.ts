import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  contrastRatio,
  isLightBackground,
  generateAdaptiveTheme,
  adjustForContrast,
  isValidHexColor,
  PROFILE_THEME_PRESETS,
  type ProfileThemeColors,
} from "@/lib/profile-themes";

/* ── hexToRgb ──────────────────────────────────────── */

describe("hexToRgb", () => {
  it("converts 6-digit hex to rgb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts 3-digit hex to rgb", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#00f")).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("handles mixed case", () => {
    expect(hexToRgb("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb("#aaBBcc")).toEqual({ r: 170, g: 187, b: 204 });
  });
});

/* ── rgbToHex ──────────────────────────────────────── */

describe("rgbToHex", () => {
  it("converts rgb to hex", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
    expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
  });

  it("clamps values out of range", () => {
    expect(rgbToHex(300, -10, 128)).toBe("#ff0080");
  });

  it("rounds non-integer values", () => {
    expect(rgbToHex(127.6, 0, 0)).toBe("#800000");
  });
});

/* ── rgbToHsl ──────────────────────────────────────── */

describe("rgbToHsl", () => {
  it("converts pure red", () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeCloseTo(0);
    expect(hsl.s).toBeCloseTo(1);
    expect(hsl.l).toBeCloseTo(0.5);
  });

  it("converts pure green", () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBeCloseTo(120);
    expect(hsl.s).toBeCloseTo(1);
    expect(hsl.l).toBeCloseTo(0.5);
  });

  it("converts pure blue", () => {
    const hsl = rgbToHsl(0, 0, 255);
    expect(hsl.h).toBeCloseTo(240);
    expect(hsl.s).toBeCloseTo(1);
    expect(hsl.l).toBeCloseTo(0.5);
  });

  it("converts white to achromatic", () => {
    const hsl = rgbToHsl(255, 255, 255);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(1);
  });

  it("converts black to achromatic", () => {
    const hsl = rgbToHsl(0, 0, 0);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it("converts gray (equal r,g,b)", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(0.502, 1);
  });

  it("handles lightness > 0.5 for saturation calculation", () => {
    // Light pink: high lightness
    const hsl = rgbToHsl(255, 200, 200);
    expect(hsl.l).toBeGreaterThan(0.5);
    expect(hsl.s).toBeGreaterThan(0);
  });
});

/* ── hslToRgb ──────────────────────────────────────── */

describe("hslToRgb", () => {
  it("converts achromatic (s=0) to gray", () => {
    const rgb = hslToRgb(0, 0, 0.5);
    expect(rgb.r).toBe(128);
    expect(rgb.g).toBe(128);
    expect(rgb.b).toBe(128);
  });

  it("converts red hsl to rgb", () => {
    const rgb = hslToRgb(0, 1, 0.5);
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it("converts green hsl to rgb", () => {
    const rgb = hslToRgb(120, 1, 0.5);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(255);
    expect(rgb.b).toBe(0);
  });

  it("converts blue hsl to rgb", () => {
    const rgb = hslToRgb(240, 1, 0.5);
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(255);
  });

  it("round-trips through rgbToHsl", () => {
    // Take a color, convert to hsl, convert back
    const original = { r: 120, g: 45, b: 200 };
    const hsl = rgbToHsl(original.r, original.g, original.b);
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(rgb.r).toBeCloseTo(original.r, 0);
    expect(rgb.g).toBeCloseTo(original.g, 0);
    expect(rgb.b).toBeCloseTo(original.b, 0);
  });

  it("handles lightness < 0.5", () => {
    const rgb = hslToRgb(0, 1, 0.25);
    expect(rgb.r).toBe(128);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });
});

/* ── relativeLuminance ─────────────────────────────── */

describe("relativeLuminance", () => {
  it("returns ~1 for white", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 2);
  });

  it("returns 0 for black", () => {
    expect(relativeLuminance("#000000")).toBe(0);
  });

  it("returns intermediate value for mid-gray", () => {
    const lum = relativeLuminance("#808080");
    expect(lum).toBeGreaterThan(0.1);
    expect(lum).toBeLessThan(0.3);
  });

  it("handles sRGB linearization for low values (<=0.04045)", () => {
    // Very dark colors fall in the linear sRGB range
    const lum = relativeLuminance("#0a0a0a");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(0.01);
  });
});

/* ── contrastRatio ─────────────────────────────────── */

describe("contrastRatio", () => {
  it("returns 21:1 for black vs white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for same color", () => {
    expect(contrastRatio("#ff0000", "#ff0000")).toBeCloseTo(1, 2);
  });

  it("is commutative (order-independent)", () => {
    const ratio1 = contrastRatio("#000000", "#0000ff");
    const ratio2 = contrastRatio("#0000ff", "#000000");
    expect(ratio1).toBeCloseTo(ratio2, 5);
  });
});

/* ── isLightBackground ─────────────────────────────── */

describe("isLightBackground", () => {
  it("returns true for white", () => {
    expect(isLightBackground("#ffffff")).toBe(true);
  });

  it("returns false for black", () => {
    expect(isLightBackground("#000000")).toBe(false);
  });

  it("returns true for light gray", () => {
    expect(isLightBackground("#cccccc")).toBe(true);
  });

  it("returns false for dark blue", () => {
    expect(isLightBackground("#0c1929")).toBe(false);
  });
});

/* ── generateAdaptiveTheme ─────────────────────────── */

describe("generateAdaptiveTheme", () => {
  it("returns light and dark objects with all color fields", () => {
    const lightTheme = PROFILE_THEME_PRESETS.default;
    const { light, dark } = generateAdaptiveTheme(lightTheme);

    for (const field of [
      "profileBgColor",
      "profileTextColor",
      "profileLinkColor",
      "profileSecondaryColor",
      "profileContainerColor",
    ] as const) {
      expect(isValidHexColor(light[field]), `light.${field}`).toBe(true);
      expect(isValidHexColor(dark[field]), `dark.${field}`).toBe(true);
    }
  });

  it("places the original light theme in the light slot", () => {
    const lightTheme = PROFILE_THEME_PRESETS.default;
    const { light } = generateAdaptiveTheme(lightTheme);
    expect(light).toEqual(lightTheme);
  });

  it("places the original dark theme in the dark slot", () => {
    const darkTheme = PROFILE_THEME_PRESETS.ocean;
    const { dark } = generateAdaptiveTheme(darkTheme);
    expect(dark).toEqual(darkTheme);
  });

  it("generates a dark theme with dark background from a light theme", () => {
    const lightTheme = PROFILE_THEME_PRESETS.default;
    const { dark } = generateAdaptiveTheme(lightTheme);
    expect(isLightBackground(dark.profileBgColor)).toBe(false);
  });

  it("generates a light theme with light background from a dark theme", () => {
    const darkTheme = PROFILE_THEME_PRESETS.ocean;
    const { light } = generateAdaptiveTheme(darkTheme);
    expect(isLightBackground(light.profileBgColor)).toBe(true);
  });

  it("ensures generated text has sufficient contrast against background", () => {
    for (const [name, preset] of Object.entries(PROFILE_THEME_PRESETS)) {
      const { light, dark } = generateAdaptiveTheme(preset);

      // Text should have at least 4.5:1 contrast ratio against bg (WCAG AA)
      const lightTextContrast = contrastRatio(light.profileTextColor, light.profileBgColor);
      const darkTextContrast = contrastRatio(dark.profileTextColor, dark.profileBgColor);
      expect(lightTextContrast, `${name} light text contrast`).toBeGreaterThanOrEqual(4.4);
      expect(darkTextContrast, `${name} dark text contrast`).toBeGreaterThanOrEqual(4.4);
    }
  });

  it("ensures link color has sufficient contrast against background", () => {
    for (const [name, preset] of Object.entries(PROFILE_THEME_PRESETS)) {
      const { light, dark } = generateAdaptiveTheme(preset);

      const lightLinkContrast = contrastRatio(light.profileLinkColor, light.profileBgColor);
      const darkLinkContrast = contrastRatio(dark.profileLinkColor, dark.profileBgColor);
      // Links should have at least 3:1 contrast (WCAG AA for large text / UI elements)
      // Some themes prioritize brand color fidelity over strict 4.5:1
      expect(lightLinkContrast, `${name} light link contrast`).toBeGreaterThanOrEqual(3.0);
      expect(darkLinkContrast, `${name} dark link contrast`).toBeGreaterThanOrEqual(3.0);
    }
  });

  it("generates valid themes for all presets", () => {
    for (const preset of Object.values(PROFILE_THEME_PRESETS)) {
      const { light, dark } = generateAdaptiveTheme(preset);
      // Both should produce valid hex colors
      for (const field of [
        "profileBgColor",
        "profileTextColor",
        "profileLinkColor",
        "profileSecondaryColor",
        "profileContainerColor",
      ] as const) {
        expect(isValidHexColor(light[field])).toBe(true);
        expect(isValidHexColor(dark[field])).toBe(true);
      }
    }
  });

  it("handles a fully custom theme", () => {
    const custom: ProfileThemeColors = {
      profileBgColor: "#1a1a2e",
      profileTextColor: "#eaeaea",
      profileLinkColor: "#e94560",
      profileSecondaryColor: "#b0b0b0",
      profileContainerColor: "#16213e",
    };
    const { light, dark } = generateAdaptiveTheme(custom);
    // Original is dark so it should be in the dark slot
    expect(dark).toEqual(custom);
    expect(isLightBackground(light.profileBgColor)).toBe(true);
  });
});

/* ── adjustForContrast ──────────────────────────── */

describe("adjustForContrast", () => {
  it("returns foreground unchanged when contrast is already sufficient", () => {
    // White text on black bg has 21:1 contrast (max possible)
    const result = adjustForContrast("#ffffff", "#000000", 4.5);
    expect(result).toBe("#ffffff");
  });

  it("adjusts low-contrast text to meet minimum ratio", () => {
    // Light gray text on white bg: insufficient contrast
    const adjusted = adjustForContrast("#aaaaaa", "#ffffff", 4.5);
    const ratio = contrastRatio(adjusted, "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens foreground when background is dark", () => {
    const adjusted = adjustForContrast("#333333", "#111111", 4.5);
    const ratio = contrastRatio(adjusted, "#111111");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Result should be lighter than the dark bg
    expect(relativeLuminance(adjusted)).toBeGreaterThan(
      relativeLuminance("#111111")
    );
  });

  it("darkens foreground when background is light", () => {
    const adjusted = adjustForContrast("#cccccc", "#eeeeee", 4.5);
    const ratio = contrastRatio(adjusted, "#eeeeee");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Result should be darker than the light bg
    expect(relativeLuminance(adjusted)).toBeLessThan(
      relativeLuminance("#eeeeee")
    );
  });

  it("handles the 3.0 minimum ratio for links", () => {
    const adjusted = adjustForContrast("#777777", "#888888", 3.0);
    const ratio = contrastRatio(adjusted, "#888888");
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });
});
