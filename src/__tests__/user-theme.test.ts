import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/birthday", () => ({
  isBirthday: vi.fn(),
  getBirthdaySparkleConfig: vi.fn(),
}));

const { isBirthday, getBirthdaySparkleConfig } = await import("@/lib/birthday");
const { buildUserTheme, NO_THEME, userThemeSelect } = await import("@/lib/user-theme");

import type { UserThemeData } from "@/lib/user-theme";

function makeUser(overrides: Partial<UserThemeData> = {}): UserThemeData {
  return {
    id: "user-1",
    tier: null,
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
    sparklefallEnabled: false,
    sparklefallSparkles: null,
    sparklefallColors: null,
    sparklefallInterval: null,
    sparklefallWind: null,
    sparklefallMaxSparkles: null,
    sparklefallMinSize: null,
    sparklefallMaxSize: null,
    birthdayMonth: null,
    birthdayDay: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants / exports
// ---------------------------------------------------------------------------

describe("NO_THEME", () => {
  it("has expected shape", () => {
    expect(NO_THEME).toEqual({
      hasCustomTheme: false,
      themeStyle: undefined,
      bgImageStyle: undefined,
      sparklefallProps: null,
    });
  });
});

describe("userThemeSelect", () => {
  it("includes all expected prisma fields", () => {
    expect(userThemeSelect.profileBgColor).toBe(true);
    expect(userThemeSelect.sparklefallEnabled).toBe(true);
    expect(userThemeSelect.birthdayMonth).toBe(true);
    expect(userThemeSelect.tier).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildUserTheme — hasCustomTheme
// ---------------------------------------------------------------------------

describe("buildUserTheme — hasCustomTheme", () => {
  it("returns false when no color fields are set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser());
    expect(result.hasCustomTheme).toBe(false);
    expect(result.themeStyle).toBeUndefined();
  });

  it("returns true when profileBgColor is set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileBgColor: "#ff0000" }));
    expect(result.hasCustomTheme).toBe(true);
  });

  it("returns true when profileTextColor is set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileTextColor: "#000" }));
    expect(result.hasCustomTheme).toBe(true);
  });

  it("returns true when profileLinkColor is set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileLinkColor: "#00f" }));
    expect(result.hasCustomTheme).toBe(true);
  });

  it("returns true when profileSecondaryColor is set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileSecondaryColor: "#888" }));
    expect(result.hasCustomTheme).toBe(true);
  });

  it("returns true when profileContainerColor is set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileContainerColor: "#fff" }));
    expect(result.hasCustomTheme).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildUserTheme — themeStyle
// ---------------------------------------------------------------------------

describe("buildUserTheme — themeStyle", () => {
  it("sets CSS variables from user colors", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(
      makeUser({
        profileBgColor: "#111",
        profileTextColor: "#222",
        profileLinkColor: "#333",
        profileSecondaryColor: "#444",
        profileContainerColor: "#555",
        profileContainerOpacity: 80,
      })
    );

    expect(result.themeStyle).toEqual({
      "--profile-bg": "#111",
      "--profile-text": "#222",
      "--profile-link": "#333",
      "--profile-secondary": "#444",
      "--profile-container": "#555",
      "--profile-container-alpha": "80%",
    });
  });

  it("uses defaults for unset color fields", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser({ profileBgColor: "#111" }));

    const style = result.themeStyle as Record<string, string>;
    expect(style["--profile-bg"]).toBe("#111");
    expect(style["--profile-text"]).toBe("#18181b");
    expect(style["--profile-link"]).toBe("#2563eb");
    expect(style["--profile-secondary"]).toBe("#71717a");
    expect(style["--profile-container"]).toBe("#f4f4f5");
    expect(style["--profile-container-alpha"]).toBe("100%");
  });
});

// ---------------------------------------------------------------------------
// buildUserTheme — bgImageStyle
// ---------------------------------------------------------------------------

describe("buildUserTheme — bgImageStyle", () => {
  it("returns undefined when no bg image set", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser());
    expect(result.bgImageStyle).toBeUndefined();
  });

  it("builds background style from user settings", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(
      makeUser({
        profileBgImage: "/backgrounds/stars.png",
        profileBgRepeat: "repeat",
        profileBgAttachment: "fixed",
        profileBgSize: "contain",
        profileBgPosition: "top left",
      })
    );

    expect(result.bgImageStyle).toEqual({
      backgroundImage: "url(/backgrounds/stars.png)",
      backgroundRepeat: "repeat",
      backgroundAttachment: "fixed",
      backgroundSize: "contain",
      backgroundPosition: "top left",
      minHeight: "calc(100vh - 57px)",
    });
  });

  it("uses defaults for unset bg properties", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(
      makeUser({ profileBgImage: "/backgrounds/stars.png" })
    );

    expect(result.bgImageStyle).toEqual({
      backgroundImage: "url(/backgrounds/stars.png)",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "scroll",
      backgroundSize: "cover",
      backgroundPosition: "center",
      minHeight: "calc(100vh - 57px)",
    });
  });
});

// ---------------------------------------------------------------------------
// buildUserTheme — sparklefallProps
// ---------------------------------------------------------------------------

describe("buildUserTheme — sparklefallProps", () => {
  it("returns null when sparklefall disabled and no birthday", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(makeUser());
    expect(result.sparklefallProps).toBeNull();
  });

  it("returns birthday sparkle config on birthday", () => {
    const birthdayConfig = {
      sparkles: '["🎂","🎉"]',
      colors: null,
      interval: 600,
      wind: null,
      maxSparkles: 80,
      minSize: null,
      maxSize: null,
    };
    vi.mocked(isBirthday).mockReturnValue(true);
    vi.mocked(getBirthdaySparkleConfig).mockReturnValue(birthdayConfig);

    const result = buildUserTheme(
      makeUser({ birthdayMonth: 4, birthdayDay: 8 })
    );
    expect(result.sparklefallProps).toEqual(birthdayConfig);
  });

  it("returns user sparkle config for premium users with sparklefall enabled", () => {
    vi.mocked(isBirthday).mockReturnValue(false);

    const result = buildUserTheme(
      makeUser({
        tier: "premium",
        sparklefallEnabled: true,
        sparklefallSparkles: '["✨"]',
        sparklefallColors: "#ff0000",
        sparklefallInterval: 300,
        sparklefallWind: 2,
        sparklefallMaxSparkles: 50,
        sparklefallMinSize: 10,
        sparklefallMaxSize: 30,
      })
    );

    expect(result.sparklefallProps).toEqual({
      sparkles: '["✨"]',
      colors: "#ff0000",
      interval: 300,
      wind: 2,
      maxSparkles: 50,
      minSize: 10,
      maxSize: 30,
    });
  });

  it("returns null for non-premium users even with sparklefall enabled", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(
      makeUser({ sparklefallEnabled: true, tier: null })
    );
    expect(result.sparklefallProps).toBeNull();
  });

  it("returns null when sparklefall disabled even for premium users", () => {
    vi.mocked(isBirthday).mockReturnValue(false);
    const result = buildUserTheme(
      makeUser({ sparklefallEnabled: false, tier: "premium" })
    );
    expect(result.sparklefallProps).toBeNull();
  });

  it("birthday sparkle takes priority over user sparkle config", () => {
    const birthdayConfig = {
      sparkles: '["🎂"]',
      colors: null,
      interval: 600,
      wind: null,
      maxSparkles: 80,
      minSize: null,
      maxSize: null,
    };
    vi.mocked(isBirthday).mockReturnValue(true);
    vi.mocked(getBirthdaySparkleConfig).mockReturnValue(birthdayConfig);

    const result = buildUserTheme(
      makeUser({
        tier: "premium",
        sparklefallEnabled: true,
        sparklefallSparkles: '["✨"]',
        birthdayMonth: 4,
        birthdayDay: 8,
      })
    );

    // Should use birthday config, not user config
    expect(result.sparklefallProps).toEqual(birthdayConfig);
  });
});
