import { describe, it, expect } from "vitest";
import {
  buildFeedContentFilter,
  buildMediaContentFilter,
  buildLoggedOutContentFilter,
  type ContentFilterPrefs,
} from "@/lib/content-filter";

// Helper to build prefs concisely
function prefs(overrides: Partial<ContentFilterPrefs> = {}): ContentFilterPrefs {
  return {
    showNsfwContent: false,
    ageVerified: false,
    hideSensitiveOverlay: false,
    showGraphicByDefault: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildFeedContentFilter
// ---------------------------------------------------------------------------

describe("buildFeedContentFilter", () => {
  // ---- NSFW off (Rule 1 & 4) ----

  it("filters ALL flagged content when NSFW is off", () => {
    const filter = buildFeedContentFilter(prefs());
    expect(filter).toEqual({
      isNsfw: false,
      isSensitive: false,
      isGraphicNudity: false,
    });
  });

  it("ignores overlay toggles when NSFW is off (Rule 4)", () => {
    const filter = buildFeedContentFilter(
      prefs({
        hideSensitiveOverlay: true,
        showGraphicByDefault: true,
        ageVerified: true,
      })
    );
    // NSFW is still off, so everything is filtered
    expect(filter).toEqual({
      isNsfw: false,
      isSensitive: false,
      isGraphicNudity: false,
    });
  });

  // ---- NSFW on, not age verified ----

  it("allows NSFW but filters sensitive/graphic when not age verified", () => {
    const filter = buildFeedContentFilter(prefs({ showNsfwContent: true }));
    // NSFW allowed (no isNsfw key), but sensitive & graphic still filtered
    expect(filter).not.toHaveProperty("isNsfw");
    expect(filter).toEqual({
      isSensitive: false,
      isGraphicNudity: false,
    });
  });

  it("filters sensitive/graphic even with overlays off when not age verified", () => {
    const filter = buildFeedContentFilter(
      prefs({
        showNsfwContent: true,
        hideSensitiveOverlay: true,
        showGraphicByDefault: true,
      })
    );
    expect(filter).toEqual({
      isSensitive: false,
      isGraphicNudity: false,
    });
  });

  // ---- NSFW on + age verified ----

  it("filters sensitive when overlay is on (age verified)", () => {
    const filter = buildFeedContentFilter(
      prefs({
        showNsfwContent: true,
        ageVerified: true,
        hideSensitiveOverlay: false,
      })
    );
    expect(filter).toEqual({
      isSensitive: false,
      isGraphicNudity: false,
    });
  });

  it("allows sensitive when NSFW on + age verified + overlay off (Rule 3)", () => {
    const filter = buildFeedContentFilter(
      prefs({
        showNsfwContent: true,
        ageVerified: true,
        hideSensitiveOverlay: true,
      })
    );
    expect(filter).not.toHaveProperty("isSensitive");
    expect(filter).toEqual({ isGraphicNudity: false });
  });

  it("allows graphic when NSFW on + age verified + showGraphic on (Rule 3)", () => {
    const filter = buildFeedContentFilter(
      prefs({
        showNsfwContent: true,
        ageVerified: true,
        showGraphicByDefault: true,
      })
    );
    expect(filter).not.toHaveProperty("isGraphicNudity");
    expect(filter).toEqual({ isSensitive: false });
  });

  it("allows all content when fully permissive (Rule 3 - all flags)", () => {
    const filter = buildFeedContentFilter(
      prefs({
        showNsfwContent: true,
        ageVerified: true,
        hideSensitiveOverlay: true,
        showGraphicByDefault: true,
      })
    );
    expect(filter).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildMediaContentFilter
// ---------------------------------------------------------------------------

describe("buildMediaContentFilter", () => {
  it("delegates to buildFeedContentFilter", () => {
    const feedFilter = buildFeedContentFilter(prefs());
    const mediaFilter = buildMediaContentFilter(prefs());
    expect(mediaFilter).toEqual(feedFilter);
  });

  it("returns same result for permissive prefs", () => {
    const p = prefs({
      showNsfwContent: true,
      ageVerified: true,
      hideSensitiveOverlay: true,
      showGraphicByDefault: true,
    });
    expect(buildMediaContentFilter(p)).toEqual(buildFeedContentFilter(p));
  });
});

// ---------------------------------------------------------------------------
// buildLoggedOutContentFilter
// ---------------------------------------------------------------------------

describe("buildLoggedOutContentFilter", () => {
  it("filters all flagged content plus logged-in-only posts", () => {
    expect(buildLoggedOutContentFilter()).toEqual({
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
      isLoggedInOnly: false,
    });
  });

  it("always returns the same object shape", () => {
    const a = buildLoggedOutContentFilter();
    const b = buildLoggedOutContentFilter();
    expect(a).toEqual(b);
  });
});
