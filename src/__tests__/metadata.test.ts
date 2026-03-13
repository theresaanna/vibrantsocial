import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildMetadata,
  truncateText,
  SITE_NAME,
  SITE_DESCRIPTION,
} from "@/lib/metadata";

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("Hello", 160)).toBe("Hello");
  });

  it("returns text at exactly maxLength unchanged", () => {
    const text = "a".repeat(160);
    expect(truncateText(text, 160)).toBe(text);
  });

  it("truncates long text with ellipsis", () => {
    const text = "a".repeat(200);
    const result = truncateText(text, 160);
    expect(result.length).toBe(160);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("trims trailing whitespace before ellipsis", () => {
    const text = "Hello world " + "a".repeat(200);
    const result = truncateText(text, 15);
    expect(result).not.toMatch(/\s\u2026$/);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles empty string", () => {
    expect(truncateText("", 160)).toBe("");
  });
});

describe("buildMetadata", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vibrantsocial.app");
  });

  it("creates metadata with title and description", () => {
    const result = buildMetadata({
      title: "Test Page",
      description: "A test description",
    });

    expect(result.title).toBe("Test Page");
    expect(result.description).toBe("A test description");
    expect(result.openGraph).toMatchObject({
      title: "Test Page",
      description: "A test description",
      siteName: SITE_NAME,
      type: "website",
    });
    expect(result.twitter).toMatchObject({
      card: "summary",
      title: "Test Page",
      description: "A test description",
    });
  });

  it("includes canonical URL and OG URL when path is provided", () => {
    const result = buildMetadata({
      title: "Profile",
      description: "User profile",
      path: "/testuser",
    });

    expect(result.openGraph).toMatchObject({
      url: "https://vibrantsocial.app/testuser",
    });
    expect(result.alternates).toEqual({
      canonical: "https://vibrantsocial.app/testuser",
    });
  });

  it("omits URL fields when path is not provided", () => {
    const result = buildMetadata({
      title: "No Path",
      description: "No path",
    });

    expect((result.openGraph as Record<string, unknown>)?.url).toBeUndefined();
    expect(result.alternates).toBeUndefined();
  });

  it("includes images in openGraph and twitter when provided", () => {
    const result = buildMetadata({
      title: "With Image",
      description: "Has an image",
      images: [{ url: "https://example.com/avatar.jpg", alt: "Avatar" }],
    });

    expect(result.openGraph).toMatchObject({
      images: [{ url: "https://example.com/avatar.jpg", alt: "Avatar" }],
    });
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://example.com/avatar.jpg"],
    });
  });

  it("uses summary card when no images", () => {
    const result = buildMetadata({
      title: "No Image",
      description: "No image",
    });

    expect(result.twitter).toMatchObject({ card: "summary" });
  });

  it("sets noIndex robots when requested", () => {
    const result = buildMetadata({
      title: "Private",
      description: "Hidden",
      noIndex: true,
    });

    expect(result.robots).toEqual({ index: false, follow: false });
  });

  it("omits robots when noIndex is not set", () => {
    const result = buildMetadata({
      title: "Public",
      description: "Visible",
    });

    expect(result.robots).toBeUndefined();
  });

  it("uses NEXTAUTH_URL as fallback", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv("NEXTAUTH_URL", "https://staging.vibrantsocial.app");

    const result = buildMetadata({
      title: "Fallback",
      description: "Test",
      path: "/test",
    });

    expect(result.openGraph).toMatchObject({
      url: "https://staging.vibrantsocial.app/test",
    });
  });
});

describe("constants", () => {
  it("exports site name", () => {
    expect(SITE_NAME).toBe("VibrantSocial");
  });

  it("exports site description", () => {
    expect(SITE_DESCRIPTION).toBeTruthy();
    expect(typeof SITE_DESCRIPTION).toBe("string");
  });
});
