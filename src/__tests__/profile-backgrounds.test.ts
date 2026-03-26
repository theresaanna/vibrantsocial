import { describe, it, expect } from "vitest";
import {
  isValidBgRepeat,
  isValidBgAttachment,
  isValidBgSize,
  isValidBgPosition,
  getDefaultsForBackground,
  type BackgroundDefinition,
} from "@/lib/profile-backgrounds";
import {
  getProfileBackgrounds,
  getPremiumProfileBackgrounds,
  getAllProfileBackgrounds,
  isPresetBackgroundSrc,
  isPremiumBackgroundSrc,
} from "@/lib/profile-backgrounds.server";

describe("profile background validation helpers", () => {
  describe("isValidBgRepeat", () => {
    it("accepts valid repeat values", () => {
      expect(isValidBgRepeat("repeat")).toBe(true);
      expect(isValidBgRepeat("repeat-x")).toBe(true);
      expect(isValidBgRepeat("repeat-y")).toBe(true);
      expect(isValidBgRepeat("no-repeat")).toBe(true);
    });

    it("rejects invalid repeat values", () => {
      expect(isValidBgRepeat("space")).toBe(false);
      expect(isValidBgRepeat("round")).toBe(false);
      expect(isValidBgRepeat("")).toBe(false);
    });
  });

  describe("isValidBgAttachment", () => {
    it("accepts valid attachment values", () => {
      expect(isValidBgAttachment("scroll")).toBe(true);
      expect(isValidBgAttachment("fixed")).toBe(true);
    });

    it("rejects invalid attachment values", () => {
      expect(isValidBgAttachment("local")).toBe(false);
      expect(isValidBgAttachment("")).toBe(false);
    });
  });

  describe("isValidBgSize", () => {
    it("accepts valid size values", () => {
      expect(isValidBgSize("cover")).toBe(true);
      expect(isValidBgSize("contain")).toBe(true);
      expect(isValidBgSize("auto")).toBe(true);
    });

    it("rejects invalid size values", () => {
      expect(isValidBgSize("100%")).toBe(false);
      expect(isValidBgSize("")).toBe(false);
    });
  });

  describe("isValidBgPosition", () => {
    it("accepts valid position values", () => {
      expect(isValidBgPosition("center")).toBe(true);
      expect(isValidBgPosition("top left")).toBe(true);
      expect(isValidBgPosition("bottom right")).toBe(true);
    });

    it("rejects invalid position values", () => {
      expect(isValidBgPosition("50% 50%")).toBe(false);
      expect(isValidBgPosition("")).toBe(false);
    });
  });
});

describe("getDefaultsForBackground", () => {
  it("returns pattern defaults for pattern category", () => {
    const bg: BackgroundDefinition = {
      id: "test",
      name: "Test",
      src: "/backgrounds/test.png",
      thumbSrc: "/backgrounds/thumbs/test.webp",
      category: "pattern",
    };
    const defaults = getDefaultsForBackground(bg);
    expect(defaults.repeat).toBe("repeat");
    expect(defaults.size).toBe("auto");
    expect(defaults.position).toBe("top left");
    expect(defaults.attachment).toBe("scroll");
  });

  it("returns photo defaults for photo category", () => {
    const bg: BackgroundDefinition = {
      id: "test",
      name: "Test",
      src: "/backgrounds/test.jpg",
      thumbSrc: "/backgrounds/thumbs/test.webp",
      category: "photo",
    };
    const defaults = getDefaultsForBackground(bg);
    expect(defaults.repeat).toBe("no-repeat");
    expect(defaults.size).toBe("cover");
    expect(defaults.position).toBe("center");
    expect(defaults.attachment).toBe("scroll");
  });

  it("allows per-background overrides", () => {
    const bg: BackgroundDefinition = {
      id: "test",
      name: "Test",
      src: "/backgrounds/test.png",
      thumbSrc: "/backgrounds/thumbs/test.webp",
      category: "pattern",
      defaults: { attachment: "fixed" },
    };
    const defaults = getDefaultsForBackground(bg);
    expect(defaults.attachment).toBe("fixed");
    // Other values remain as category defaults
    expect(defaults.repeat).toBe("repeat");
  });
});

describe("getProfileBackgrounds", () => {
  it("returns an array of background definitions", () => {
    const backgrounds = getProfileBackgrounds();
    expect(Array.isArray(backgrounds)).toBe(true);
    expect(backgrounds.length).toBeGreaterThan(0);
  });

  it("each background has required fields", () => {
    const backgrounds = getProfileBackgrounds();
    for (const bg of backgrounds) {
      expect(bg.id).toBeTruthy();
      expect(bg.name).toBeTruthy();
      expect(bg.src).toMatch(/^\/backgrounds\/[^/]+\.\w+$/);
      expect(bg.thumbSrc).toBeTruthy();
      expect(["pattern", "photo"]).toContain(bg.category);
    }
  });

  it("does not include premium backgrounds", () => {
    const backgrounds = getProfileBackgrounds();
    for (const bg of backgrounds) {
      expect(bg.src).not.toContain("/premium/");
      expect(bg.premiumOnly).toBeFalsy();
    }
  });

  it("includes the ouija background as a pattern", () => {
    const backgrounds = getProfileBackgrounds();
    const ouija = backgrounds.find((bg) => bg.id === "free-ouija-vector-background");
    expect(ouija).toBeDefined();
    expect(ouija!.category).toBe("pattern");
  });
});

describe("getPremiumProfileBackgrounds", () => {
  it("returns an array of premium background definitions", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    expect(Array.isArray(premiumBgs)).toBe(true);
    expect(premiumBgs.length).toBeGreaterThan(0);
  });

  it("all premium backgrounds are marked as premiumOnly", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    for (const bg of premiumBgs) {
      expect(bg.premiumOnly).toBe(true);
    }
  });

  it("most premium backgrounds are categorized as patterns", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    const patterns = premiumBgs.filter((bg) => bg.category === "pattern");
    const photos = premiumBgs.filter((bg) => bg.category === "photo");
    expect(patterns.length).toBeGreaterThan(photos.length);
    // Every premium bg should be one of the two valid categories
    for (const bg of premiumBgs) {
      expect(["pattern", "photo"]).toContain(bg.category);
    }
  });

  it("panoramic premium backgrounds are categorized as photos", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    const palmLeaves = premiumBgs.find((bg) => bg.id === "palm-leaves-background-10-b-SH_generated");
    expect(palmLeaves).toBeDefined();
    expect(palmLeaves!.category).toBe("photo");
  });

  it("premium background srcs use the /backgrounds/premium/ path", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    for (const bg of premiumBgs) {
      expect(bg.src).toMatch(/^\/backgrounds\/premium\//);
    }
  });

  it("each premium background has a thumbnail", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    for (const bg of premiumBgs) {
      expect(bg.thumbSrc).toMatch(/\/thumbs\//);
    }
  });
});

describe("getAllProfileBackgrounds", () => {
  it("combines free and premium backgrounds", () => {
    const all = getAllProfileBackgrounds();
    const free = getProfileBackgrounds();
    const premium = getPremiumProfileBackgrounds();
    expect(all.length).toBe(free.length + premium.length);
  });

  it("free backgrounds come before premium backgrounds", () => {
    const all = getAllProfileBackgrounds();
    const firstPremiumIdx = all.findIndex((bg) => bg.premiumOnly);
    const lastFreeIdx = all.findLastIndex((bg) => !bg.premiumOnly);
    expect(firstPremiumIdx).toBeGreaterThan(lastFreeIdx);
  });
});

describe("isPresetBackgroundSrc", () => {
  it("accepts paths in /backgrounds/ directory", () => {
    const backgrounds = getProfileBackgrounds();
    if (backgrounds.length > 0) {
      expect(isPresetBackgroundSrc(backgrounds[0].src)).toBe(true);
    }
  });

  it("accepts paths in /backgrounds/premium/ directory", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    if (premiumBgs.length > 0) {
      expect(isPresetBackgroundSrc(premiumBgs[0].src)).toBe(true);
    }
  });

  it("rejects paths outside /backgrounds/", () => {
    expect(isPresetBackgroundSrc("/images/test.jpg")).toBe(false);
    expect(isPresetBackgroundSrc("https://example.com/bg.jpg")).toBe(false);
  });

  it("rejects non-existent files", () => {
    expect(isPresetBackgroundSrc("/backgrounds/nonexistent.jpg")).toBe(false);
  });
});

describe("isPremiumBackgroundSrc", () => {
  it("identifies premium background paths", () => {
    const premiumBgs = getPremiumProfileBackgrounds();
    if (premiumBgs.length > 0) {
      expect(isPremiumBackgroundSrc(premiumBgs[0].src)).toBe(true);
    }
  });

  it("returns false for free background paths", () => {
    const backgrounds = getProfileBackgrounds();
    for (const bg of backgrounds) {
      expect(isPremiumBackgroundSrc(bg.src)).toBe(false);
    }
  });

  it("returns false for non-existent premium paths", () => {
    expect(isPremiumBackgroundSrc("/backgrounds/premium/nonexistent.jpg")).toBe(false);
  });

  it("returns false for non-background paths", () => {
    expect(isPremiumBackgroundSrc("/images/test.jpg")).toBe(false);
  });
});
