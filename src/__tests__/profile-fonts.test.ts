import { describe, it, expect } from "vitest";
import {
  USERNAME_FONTS,
  getFontById,
  isValidFontId,
  getFontsForTier,
  getGoogleFontUrl,
  getGoogleFontsUrl,
} from "@/lib/profile-fonts";

describe("profile-fonts", () => {
  describe("USERNAME_FONTS", () => {
    it("contains both free and premium fonts", () => {
      const free = USERNAME_FONTS.filter((f) => f.tier === "free");
      const premium = USERNAME_FONTS.filter((f) => f.tier === "premium");
      expect(free.length).toBeGreaterThan(0);
      expect(premium.length).toBeGreaterThan(0);
    });

    it("has unique ids", () => {
      const ids = USERNAME_FONTS.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("includes Sofadi One and Jersey 10 as free fonts", () => {
      const freeIds = USERNAME_FONTS.filter((f) => f.tier === "free").map((f) => f.id);
      expect(freeIds).toContain("sofadi-one");
      expect(freeIds).toContain("jersey-10");
    });

    it("includes all premium fonts", () => {
      const premiumIds = USERNAME_FONTS.filter((f) => f.tier === "premium").map((f) => f.id);
      expect(premiumIds).toContain("gugi");
      expect(premiumIds).toContain("turret-road");
      expect(premiumIds).toContain("nova-mono");
      expect(premiumIds).toContain("ewert");
      expect(premiumIds).toContain("ballet");
      expect(premiumIds).toContain("rubik-puddles");
      expect(premiumIds).toContain("hachi-maru-pop");
      expect(premiumIds).toContain("ms-madi");
      expect(premiumIds).toContain("jacquard-24");
    });
  });

  describe("getFontById", () => {
    it("returns font for valid id", () => {
      const font = getFontById("sofadi-one");
      expect(font).not.toBeNull();
      expect(font!.name).toBe("Sofadi One");
      expect(font!.tier).toBe("free");
    });

    it("returns null for invalid id", () => {
      expect(getFontById("nonexistent")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(getFontById(null)).toBeNull();
      expect(getFontById(undefined)).toBeNull();
    });
  });

  describe("isValidFontId", () => {
    it("returns true for valid font ids", () => {
      expect(isValidFontId("sofadi-one")).toBe(true);
      expect(isValidFontId("gugi")).toBe(true);
      expect(isValidFontId("jacquard-24")).toBe(true);
    });

    it("returns false for invalid font ids", () => {
      expect(isValidFontId("invalid")).toBe(false);
      expect(isValidFontId("")).toBe(false);
      expect(isValidFontId("lexend")).toBe(false);
    });
  });

  describe("getFontsForTier", () => {
    it("returns only free fonts for free tier", () => {
      const fonts = getFontsForTier("free");
      expect(fonts.every((f) => f.tier === "free")).toBe(true);
      expect(fonts.length).toBe(2);
    });

    it("returns all fonts for premium tier", () => {
      const fonts = getFontsForTier("premium");
      expect(fonts.length).toBe(USERNAME_FONTS.length);
    });
  });

  describe("getGoogleFontUrl", () => {
    it("returns a valid Google Fonts URL", () => {
      const font = getFontById("sofadi-one")!;
      const url = getGoogleFontUrl(font);
      expect(url).toContain("fonts.googleapis.com");
      expect(url).toContain("Sofadi+One");
      expect(url).toContain("display=swap");
    });
  });

  describe("getGoogleFontsUrl", () => {
    it("returns a URL with multiple families", () => {
      const fonts = [getFontById("sofadi-one")!, getFontById("jersey-10")!];
      const url = getGoogleFontsUrl(fonts);
      expect(url).toContain("Sofadi+One");
      expect(url).toContain("Jersey+10");
    });
  });
});
