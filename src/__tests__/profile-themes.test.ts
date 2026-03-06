import { describe, it, expect } from "vitest";
import {
  isValidHexColor,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
} from "@/lib/profile-themes";

describe("isValidHexColor", () => {
  it("accepts 6-digit hex colors", () => {
    expect(isValidHexColor("#ff0000")).toBe(true);
    expect(isValidHexColor("#AABBCC")).toBe(true);
    expect(isValidHexColor("#000000")).toBe(true);
    expect(isValidHexColor("#ffffff")).toBe(true);
  });

  it("accepts 3-digit hex colors", () => {
    expect(isValidHexColor("#f00")).toBe(true);
    expect(isValidHexColor("#ABC")).toBe(true);
  });

  it("rejects colors without # prefix", () => {
    expect(isValidHexColor("ff0000")).toBe(false);
    expect(isValidHexColor("abc")).toBe(false);
  });

  it("rejects invalid hex strings", () => {
    expect(isValidHexColor("#xyz")).toBe(false);
    expect(isValidHexColor("not-a-color")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("#1234567")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
    expect(isValidHexColor("#")).toBe(false);
  });
});

describe("PROFILE_THEME_PRESETS", () => {
  it("has all required presets", () => {
    expect(Object.keys(PROFILE_THEME_PRESETS)).toEqual(
      expect.arrayContaining(["default", "ocean", "forest", "sunset", "midnight"])
    );
  });

  it("each preset has all 5 color fields with valid hex values", () => {
    for (const [name, preset] of Object.entries(PROFILE_THEME_PRESETS)) {
      for (const field of THEME_COLOR_FIELDS) {
        expect(preset[field], `${name}.${field}`).toBeDefined();
        expect(
          isValidHexColor(preset[field]),
          `${name}.${field} = ${preset[field]} should be valid hex`
        ).toBe(true);
      }
    }
  });
});

describe("THEME_COLOR_FIELDS", () => {
  it("contains exactly 5 fields", () => {
    expect(THEME_COLOR_FIELDS).toHaveLength(5);
  });

  it("contains the expected field names", () => {
    expect(THEME_COLOR_FIELDS).toContain("profileBgColor");
    expect(THEME_COLOR_FIELDS).toContain("profileTextColor");
    expect(THEME_COLOR_FIELDS).toContain("profileLinkColor");
    expect(THEME_COLOR_FIELDS).toContain("profileSecondaryColor");
    expect(THEME_COLOR_FIELDS).toContain("profileContainerColor");
  });
});
