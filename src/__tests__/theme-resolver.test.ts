import { describe, it, expect } from "vitest";
import {
  resolveUserTheme,
  THEME_VERSION,
  type ThemeResolverUser,
} from "@/lib/theme-resolver";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";
import { SPARKLEFALL_PRESETS, SPARKLEFALL_DEFAULTS } from "@/lib/sparklefall-presets";

const BASE_USER: ThemeResolverUser = {
  id: "u1",
  tier: null,
  premiumExpiresAt: null,
  profileBgColor: null,
  profileTextColor: null,
  profileLinkColor: null,
  profileSecondaryColor: null,
  profileContainerColor: null,
  profileContainerOpacity: null,
  profileBgImage: null,
  profileBgRepeat: null,
  profileBgAttachment: null,
  profileBgSize: null,
  profileBgPosition: null,
  profileFrameId: null,
  usernameFont: null,
  sparklefallEnabled: false,
  sparklefallPreset: null,
  sparklefallSparkles: null,
  sparklefallColors: null,
  sparklefallInterval: null,
  sparklefallWind: null,
  sparklefallMaxSparkles: null,
  sparklefallMinSize: null,
  sparklefallMaxSize: null,
  birthdayMonth: null,
  birthdayDay: null,
};

// A non-birthday anchor date to keep sparklefall off by default.
const NON_BIRTHDAY = new Date("2026-07-15T12:00:00Z");

describe("resolveUserTheme — defaults", () => {
  it("returns version 1 and no custom theme when every color is null", () => {
    const result = resolveUserTheme(BASE_USER, { now: NON_BIRTHDAY });
    expect(result.version).toBe(THEME_VERSION);
    expect(result.hasCustomTheme).toBe(false);
    expect(result.colors).toEqual({
      bg: PROFILE_THEME_PRESETS.default.profileBgColor,
      text: PROFILE_THEME_PRESETS.default.profileTextColor,
      link: PROFILE_THEME_PRESETS.default.profileLinkColor,
      secondary: PROFILE_THEME_PRESETS.default.profileSecondaryColor,
      container: PROFILE_THEME_PRESETS.default.profileContainerColor,
    });
    expect(result.container.opacity).toBe(100);
    expect(result.background).toBeNull();
    expect(result.font).toBeNull();
    expect(result.frame).toBeNull();
    expect(result.sparklefall).toBeNull();
  });

  it("marks hasCustomTheme true when any color is set", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, profileBgColor: "#123456" },
      { now: NON_BIRTHDAY },
    );
    expect(result.hasCustomTheme).toBe(true);
    expect(result.colors.bg).toBe("#123456");
  });
});

describe("resolveUserTheme — background", () => {
  it("returns null when no image is set", () => {
    const result = resolveUserTheme(BASE_USER, { now: NON_BIRTHDAY });
    expect(result.background).toBeNull();
  });

  it("falls back to safe defaults for invalid css enum values", () => {
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        profileBgImage: "/backgrounds/skulls-pattern.png",
        profileBgRepeat: "not-a-repeat",
        profileBgAttachment: "oops",
        profileBgSize: "huge",
        profileBgPosition: "upside-down",
      },
      { now: NON_BIRTHDAY },
    );
    expect(result.background).toEqual({
      imageUrl: "/backgrounds/skulls-pattern.png",
      repeat: "no-repeat",
      attachment: "scroll",
      size: "100% 100%",
      position: "center",
    });
  });

  it("prefixes relative paths with assetBaseUrl when provided", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, profileBgImage: "/backgrounds/pattern-1.jpg" },
      { now: NON_BIRTHDAY, assetBaseUrl: "https://vibrantsocial.app" },
    );
    expect(result.background?.imageUrl).toBe(
      "https://vibrantsocial.app/backgrounds/pattern-1.jpg",
    );
  });

  it("leaves absolute URLs (blob uploads) unchanged", () => {
    const blobUrl = "https://blob.vercel-storage.com/custom/abc.jpg";
    const result = resolveUserTheme(
      { ...BASE_USER, profileBgImage: blobUrl },
      { now: NON_BIRTHDAY, assetBaseUrl: "https://vibrantsocial.app" },
    );
    expect(result.background?.imageUrl).toBe(blobUrl);
  });
});

describe("resolveUserTheme — font", () => {
  it("returns null for unknown font ids", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, usernameFont: "not-a-font" },
      { now: NON_BIRTHDAY },
    );
    expect(result.font).toBeNull();
  });

  it("resolves a known font to id, name, family, tier, cssUrl", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, usernameFont: "great-vibes" },
      { now: NON_BIRTHDAY },
    );
    expect(result.font).toMatchObject({
      id: "great-vibes",
      name: "Great Vibes",
      googleFamily: "Great+Vibes",
      tier: "premium",
    });
    expect(result.font?.cssUrl).toContain("family=Great+Vibes");
  });
});

describe("resolveUserTheme — frame", () => {
  it("returns null for unknown frame ids", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, profileFrameId: "nope" },
      { now: NON_BIRTHDAY },
    );
    expect(result.frame).toBeNull();
  });

  it("resolves frame and fills numeric defaults", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, profileFrameId: "neon-1" },
      { now: NON_BIRTHDAY, assetBaseUrl: "https://vibrantsocial.app" },
    );
    expect(result.frame).toMatchObject({
      id: "neon-1",
      imageUrl: "https://vibrantsocial.app/frames/neon-1.svg",
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
      frameScale: 1,
    });
  });

  it("preserves frame-specific scale/offset overrides", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, profileFrameId: "decorative-1" },
      { now: NON_BIRTHDAY },
    );
    expect(result.frame).toMatchObject({
      scaleX: 1.15,
      scaleY: 0.92,
      offsetX: 3,
      offsetY: 3,
    });
  });
});

describe("resolveUserTheme — sparklefall gating", () => {
  it("stays off when enabled but user is not premium", () => {
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        tier: "free",
        sparklefallEnabled: true,
        sparklefallPreset: "pride",
      },
      { now: NON_BIRTHDAY },
    );
    expect(result.sparklefall).toBeNull();
  });

  it("stays off when premium but not enabled", () => {
    const result = resolveUserTheme(
      { ...BASE_USER, tier: "premium", sparklefallEnabled: false },
      { now: NON_BIRTHDAY },
    );
    expect(result.sparklefall).toBeNull();
  });

  it("treats premiumExpiresAt in the past as not premium", () => {
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        tier: "premium",
        premiumExpiresAt: new Date("2020-01-01"),
        sparklefallEnabled: true,
      },
      { now: NON_BIRTHDAY },
    );
    expect(result.sparklefall).toBeNull();
  });

  it("activates for premium+enabled and resolves preset sparkles", () => {
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        tier: "premium",
        sparklefallEnabled: true,
        sparklefallPreset: "pride",
      },
      { now: NON_BIRTHDAY },
    );
    expect(result.sparklefall).not.toBeNull();
    expect(result.sparklefall?.reason).toBe("user");
    expect(result.sparklefall?.sparkles).toEqual(SPARKLEFALL_PRESETS.pride.sparkles);
    expect(result.sparklefall?.interval).toBe(SPARKLEFALL_DEFAULTS.interval);
  });

  it("prefers user-provided json sparkles/colors over preset", () => {
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        tier: "premium",
        sparklefallEnabled: true,
        sparklefallPreset: "pride",
        sparklefallSparkles: JSON.stringify(["🔥", "💧"]),
        sparklefallColors: JSON.stringify(["#ff0000"]),
        sparklefallInterval: 400,
        sparklefallWind: 0.3,
        sparklefallMaxSparkles: 120,
        sparklefallMinSize: 8,
        sparklefallMaxSize: 40,
      },
      { now: NON_BIRTHDAY },
    );
    expect(result.sparklefall).toMatchObject({
      sparkles: ["🔥", "💧"],
      colors: ["#ff0000"],
      interval: 400,
      wind: 0.3,
      maxSparkles: 120,
      minSize: 8,
      maxSize: 40,
    });
  });
});

describe("resolveUserTheme — birthday", () => {
  it("activates sparklefall on birthday regardless of premium/enabled", () => {
    const birthday = new Date("2026-05-10T12:00:00Z");
    const result = resolveUserTheme(
      {
        ...BASE_USER,
        tier: "free",
        sparklefallEnabled: false,
        birthdayMonth: 5,
        birthdayDay: 10,
      },
      { now: birthday },
    );
    expect(result.sparklefall).not.toBeNull();
    expect(result.sparklefall?.reason).toBe("birthday");
    expect(result.sparklefall?.sparkles).toEqual(SPARKLEFALL_PRESETS.party.sparkles);
  });
});
