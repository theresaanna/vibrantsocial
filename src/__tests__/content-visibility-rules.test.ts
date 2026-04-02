import { describe, it, expect } from "vitest";
import {
  buildFeedContentFilter,
  buildMediaContentFilter,
  buildLoggedOutContentFilter,
} from "@/lib/content-filter";

/**
 * Content visibility rules — comprehensive test suite.
 *
 * Terminology:
 * - "NSFW off" = showNsfwContent: false
 * - "NSFW on"  = showNsfwContent: true
 * - "overlay off" = the user has opted to remove the click-to-reveal overlay
 *   for that category (hideSensitiveOverlay / showGraphicByDefault)
 * - "age verified" = ageVerified: true (always required for sensitive/graphic)
 *
 * A filter of `{ isNsfw: false }` means NSFW posts are EXCLUDED.
 * Absence of a key means posts of that type are INCLUDED.
 */

// ---------------------------------------------------------------------------
// Helper: given a filter, returns which content types are allowed through
// ---------------------------------------------------------------------------
function allowedTypes(filter: Record<string, unknown>) {
  return {
    nsfw: !("isNsfw" in filter),
    sensitive: !("isSensitive" in filter),
    graphic: !("isGraphicNudity" in filter),
  };
}

// ---------------------------------------------------------------------------
// Rule 1: Logged in, NSFW off
// Only see nsfw, explicit, and sensitive on special profile tabs (with
// overlays). Never see them in media, for-you, discussion, list feeds.
// ---------------------------------------------------------------------------
describe("Rule 1: logged in, NSFW off", () => {
  const prefs = {
    showNsfwContent: false,
    ageVerified: true,
    hideSensitiveOverlay: false,
    showGraphicByDefault: false,
  };

  it("feed filter excludes NSFW posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isNsfw", false);
  });

  it("feed filter excludes sensitive posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isSensitive", false);
  });

  it("feed filter excludes graphic/explicit posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isGraphicNudity", false);
  });

  it("media filter excludes all flagged posts", () => {
    const filter = buildMediaContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: false, sensitive: false, graphic: false });
  });

  it("no flagged content reaches any feed", () => {
    const filter = buildFeedContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed.nsfw).toBe(false);
    expect(allowed.sensitive).toBe(false);
    expect(allowed.graphic).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Logged in, NSFW on, age verified (but overlays NOT turned off)
// See NSFW with overlays on media, for-you, discussion, list feeds.
// Explicit and sensitive are still filtered — only on special profile tabs.
// ---------------------------------------------------------------------------
describe("Rule 2: logged in, NSFW on, age verified, overlays default (on)", () => {
  const prefs = {
    showNsfwContent: true,
    ageVerified: true,
    hideSensitiveOverlay: false,
    showGraphicByDefault: false,
  };

  it("feed filter INCLUDES NSFW posts (will render with overlay)", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).not.toHaveProperty("isNsfw");
  });

  it("feed filter still EXCLUDES sensitive posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isSensitive", false);
  });

  it("feed filter still EXCLUDES graphic/explicit posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isGraphicNudity", false);
  });

  it("media filter matches feed filter", () => {
    const feedFilter = buildFeedContentFilter(prefs);
    const mediaFilter = buildMediaContentFilter(prefs);
    expect(mediaFilter).toEqual(feedFilter);
  });
});

// ---------------------------------------------------------------------------
// Rule 3a: Logged in, NSFW on, age verified, sensitive overlay turned off
// Sensitive posts now appear in feeds without overlay.
// NSFW appears with overlay. Graphic still filtered.
// ---------------------------------------------------------------------------
describe("Rule 3a: NSFW on, age verified, sensitive overlay OFF", () => {
  const prefs = {
    showNsfwContent: true,
    ageVerified: true,
    hideSensitiveOverlay: true,
    showGraphicByDefault: false,
  };

  it("feed filter INCLUDES NSFW posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).not.toHaveProperty("isNsfw");
  });

  it("feed filter INCLUDES sensitive posts (overlay removed)", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).not.toHaveProperty("isSensitive");
  });

  it("feed filter still EXCLUDES graphic/explicit posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isGraphicNudity", false);
  });

  it("media filter also includes sensitive", () => {
    const filter = buildMediaContentFilter(prefs);
    expect(filter).not.toHaveProperty("isSensitive");
  });
});

// ---------------------------------------------------------------------------
// Rule 3b: Logged in, NSFW on, age verified, graphic overlay turned off
// Graphic posts now appear in feeds without overlay.
// NSFW appears with overlay. Sensitive still filtered.
// ---------------------------------------------------------------------------
describe("Rule 3b: NSFW on, age verified, graphic overlay OFF", () => {
  const prefs = {
    showNsfwContent: true,
    ageVerified: true,
    hideSensitiveOverlay: false,
    showGraphicByDefault: true,
  };

  it("feed filter INCLUDES NSFW posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).not.toHaveProperty("isNsfw");
  });

  it("feed filter still EXCLUDES sensitive posts", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isSensitive", false);
  });

  it("feed filter INCLUDES graphic/explicit posts (overlay removed)", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).not.toHaveProperty("isGraphicNudity");
  });

  it("media filter also includes graphic", () => {
    const filter = buildMediaContentFilter(prefs);
    expect(filter).not.toHaveProperty("isGraphicNudity");
  });
});

// ---------------------------------------------------------------------------
// Rule 3c: Logged in, NSFW on, age verified, BOTH overlays turned off
// NSFW, sensitive, and graphic all appear in feeds.
// ---------------------------------------------------------------------------
describe("Rule 3c: NSFW on, age verified, both overlays OFF", () => {
  const prefs = {
    showNsfwContent: true,
    ageVerified: true,
    hideSensitiveOverlay: true,
    showGraphicByDefault: true,
  };

  it("feed filter includes all three flagged types", () => {
    const filter = buildFeedContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: true, sensitive: true, graphic: true });
  });

  it("filter is empty (no restrictions)", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(Object.keys(filter)).toHaveLength(0);
  });

  it("media filter also includes all three", () => {
    const filter = buildMediaContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: true, sensitive: true, graphic: true });
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Logged in, NSFW off, overlays toggled off
// Treat as if overlays are on — filter ALL nsfw, sensitive, explicit
// from feeds. NSFW being off overrides overlay settings.
// ---------------------------------------------------------------------------
describe("Rule 4: logged in, NSFW off, overlays toggled off", () => {
  const prefs = {
    showNsfwContent: false,
    ageVerified: true,
    hideSensitiveOverlay: true,
    showGraphicByDefault: true,
  };

  it("feed filter EXCLUDES NSFW despite overlay settings", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isNsfw", false);
  });

  it("feed filter EXCLUDES sensitive despite overlay being off", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isSensitive", false);
  });

  it("feed filter EXCLUDES graphic despite overlay being off", () => {
    const filter = buildFeedContentFilter(prefs);
    expect(filter).toHaveProperty("isGraphicNudity", false);
  });

  it("no flagged content reaches any feed", () => {
    const filter = buildFeedContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: false, sensitive: false, graphic: false });
  });

  it("media filter also excludes everything", () => {
    const filter = buildMediaContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: false, sensitive: false, graphic: false });
  });
});

// ---------------------------------------------------------------------------
// Age verification is ALWAYS required for sensitive and graphic
// Even with NSFW on and overlays off, missing age verification blocks them.
// ---------------------------------------------------------------------------
describe("Age verification is mandatory for sensitive/graphic", () => {
  it("NSFW on, overlays off, NOT age verified: sensitive filtered", () => {
    const filter = buildFeedContentFilter({
      showNsfwContent: true,
      ageVerified: false,
      hideSensitiveOverlay: true,
      showGraphicByDefault: true,
    });
    expect(filter).toHaveProperty("isSensitive", false);
  });

  it("NSFW on, overlays off, NOT age verified: graphic filtered", () => {
    const filter = buildFeedContentFilter({
      showNsfwContent: true,
      ageVerified: false,
      hideSensitiveOverlay: true,
      showGraphicByDefault: true,
    });
    expect(filter).toHaveProperty("isGraphicNudity", false);
  });

  it("NSFW on, NOT age verified: NSFW still included (no age gate on NSFW)", () => {
    const filter = buildFeedContentFilter({
      showNsfwContent: true,
      ageVerified: false,
      hideSensitiveOverlay: false,
      showGraphicByDefault: false,
    });
    expect(filter).not.toHaveProperty("isNsfw");
  });

  it("NSFW on, age verified, sensitive overlay off: sensitive included", () => {
    const filter = buildFeedContentFilter({
      showNsfwContent: true,
      ageVerified: true,
      hideSensitiveOverlay: true,
      showGraphicByDefault: false,
    });
    expect(filter).not.toHaveProperty("isSensitive");
  });

  it("NSFW on, age verified, graphic overlay off: graphic included", () => {
    const filter = buildFeedContentFilter({
      showNsfwContent: true,
      ageVerified: true,
      hideSensitiveOverlay: false,
      showGraphicByDefault: true,
    });
    expect(filter).not.toHaveProperty("isGraphicNudity");
  });
});

// ---------------------------------------------------------------------------
// Rule 4 variant: NSFW off, only sensitive overlay off
// ---------------------------------------------------------------------------
describe("Rule 4 variant: NSFW off, only sensitive overlay off", () => {
  const prefs = {
    showNsfwContent: false,
    ageVerified: true,
    hideSensitiveOverlay: true,
    showGraphicByDefault: false,
  };

  it("still excludes all flagged content from feeds", () => {
    const filter = buildFeedContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: false, sensitive: false, graphic: false });
  });
});

// ---------------------------------------------------------------------------
// Rule 4 variant: NSFW off, only graphic overlay off
// ---------------------------------------------------------------------------
describe("Rule 4 variant: NSFW off, only graphic overlay off", () => {
  const prefs = {
    showNsfwContent: false,
    ageVerified: true,
    hideSensitiveOverlay: false,
    showGraphicByDefault: true,
  };

  it("still excludes all flagged content from feeds", () => {
    const filter = buildFeedContentFilter(prefs);
    const allowed = allowedTypes(filter);
    expect(allowed).toEqual({ nsfw: false, sensitive: false, graphic: false });
  });
});

// ---------------------------------------------------------------------------
// Logged-out users
// ---------------------------------------------------------------------------
describe("Logged-out users", () => {
  it("blocks all flagged content and logged-in-only posts", () => {
    const filter = buildLoggedOutContentFilter();
    expect(filter).toEqual({
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
      isLoggedInOnly: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Exhaustive pref combinations — truth table
// ---------------------------------------------------------------------------
describe("Exhaustive pref combinations (truth table)", () => {
  const cases: Array<{
    showNsfwContent: boolean;
    ageVerified: boolean;
    hideSensitiveOverlay: boolean;
    showGraphicByDefault: boolean;
    expectedNsfw: boolean;
    expectedSensitive: boolean;
    expectedGraphic: boolean;
  }> = [
    // NSFW off — nothing passes regardless of age/overlays
    { showNsfwContent: false, ageVerified: false, hideSensitiveOverlay: false, showGraphicByDefault: false, expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: false, ageVerified: true,  hideSensitiveOverlay: false, showGraphicByDefault: false, expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: false, ageVerified: true,  hideSensitiveOverlay: true,  showGraphicByDefault: false, expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: false, ageVerified: true,  hideSensitiveOverlay: false, showGraphicByDefault: true,  expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: false, ageVerified: true,  hideSensitiveOverlay: true,  showGraphicByDefault: true,  expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: false, ageVerified: false, hideSensitiveOverlay: true,  showGraphicByDefault: true,  expectedNsfw: false, expectedSensitive: false, expectedGraphic: false },

    // NSFW on, NOT age verified — nsfw passes; sensitive/graphic blocked
    { showNsfwContent: true,  ageVerified: false, hideSensitiveOverlay: false, showGraphicByDefault: false, expectedNsfw: true,  expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: true,  ageVerified: false, hideSensitiveOverlay: true,  showGraphicByDefault: true,  expectedNsfw: true,  expectedSensitive: false, expectedGraphic: false },

    // NSFW on, age verified — nsfw always passes; sensitive/graphic depend on overlay
    { showNsfwContent: true,  ageVerified: true,  hideSensitiveOverlay: false, showGraphicByDefault: false, expectedNsfw: true,  expectedSensitive: false, expectedGraphic: false },
    { showNsfwContent: true,  ageVerified: true,  hideSensitiveOverlay: true,  showGraphicByDefault: false, expectedNsfw: true,  expectedSensitive: true,  expectedGraphic: false },
    { showNsfwContent: true,  ageVerified: true,  hideSensitiveOverlay: false, showGraphicByDefault: true,  expectedNsfw: true,  expectedSensitive: false, expectedGraphic: true  },
    { showNsfwContent: true,  ageVerified: true,  hideSensitiveOverlay: true,  showGraphicByDefault: true,  expectedNsfw: true,  expectedSensitive: true,  expectedGraphic: true  },
  ];

  it.each(cases)(
    "nsfw=$showNsfwContent age=$ageVerified sensitive-overlay=$hideSensitiveOverlay graphic-overlay=$showGraphicByDefault → nsfw=$expectedNsfw sensitive=$expectedSensitive graphic=$expectedGraphic",
    ({ showNsfwContent, ageVerified, hideSensitiveOverlay, showGraphicByDefault, expectedNsfw, expectedSensitive, expectedGraphic }) => {
      const filter = buildFeedContentFilter({ showNsfwContent, ageVerified, hideSensitiveOverlay, showGraphicByDefault });
      const allowed = allowedTypes(filter);
      expect(allowed.nsfw).toBe(expectedNsfw);
      expect(allowed.sensitive).toBe(expectedSensitive);
      expect(allowed.graphic).toBe(expectedGraphic);
    }
  );
});
