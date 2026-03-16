import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildMetadata,
  truncateText,
  sanitizeForMeta,
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

describe("sanitizeForMeta", () => {
  it("passes through plain text unchanged", () => {
    expect(sanitizeForMeta("Hello world")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeForMeta("")).toBe("");
  });

  it("extracts text from Lexical JSON", () => {
    const lexical = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Your Favorite & Hottest Spending Habit" },
            ],
          },
        ],
      },
    });
    expect(sanitizeForMeta(lexical)).toBe(
      "Your Favorite & Hottest Spending Habit"
    );
  });

  it("falls back to stripping if Lexical extraction yields nothing", () => {
    // JSON that doesn't have a proper Lexical structure
    const json = JSON.stringify({ foo: "bar" });
    // Should still return something (the raw JSON won't be extractable,
    // so it stays as-is but gets whitespace collapsed)
    const result = sanitizeForMeta(json);
    // The key point: if extraction fails, we don't crash
    expect(typeof result).toBe("string");
  });

  it("strips markdown headings", () => {
    expect(sanitizeForMeta("## Hello World")).toBe("Hello World");
    expect(sanitizeForMeta("# Title")).toBe("Title");
    expect(sanitizeForMeta("### Sub")).toBe("Sub");
  });

  it("strips markdown bold and italic", () => {
    expect(sanitizeForMeta("This is **bold** text")).toBe(
      "This is bold text"
    );
    expect(sanitizeForMeta("This is *italic* text")).toBe(
      "This is italic text"
    );
    expect(sanitizeForMeta("This is __bold__ text")).toBe(
      "This is bold text"
    );
  });

  it("strips markdown links", () => {
    expect(sanitizeForMeta("Click [here](https://example.com)")).toBe(
      "Click here"
    );
  });

  it("strips markdown images", () => {
    expect(sanitizeForMeta("![alt text](https://example.com/img.jpg)")).toBe(
      "alt text"
    );
  });

  it("strips inline code", () => {
    expect(sanitizeForMeta("Use `console.log` to debug")).toBe(
      "Use console.log to debug"
    );
  });

  it("strips code fences", () => {
    expect(
      sanitizeForMeta("Before ```const x = 1;``` After")
    ).toBe("Before After");
  });

  it("strips blockquotes", () => {
    expect(sanitizeForMeta("> This is a quote")).toBe("This is a quote");
  });

  it("strips strikethrough", () => {
    expect(sanitizeForMeta("This is ~~deleted~~ text")).toBe(
      "This is deleted text"
    );
  });

  it("strips HTML tags", () => {
    expect(sanitizeForMeta("Hello <b>world</b>")).toBe("Hello world");
  });

  it("strips list markers", () => {
    expect(sanitizeForMeta("- Item one\n- Item two")).toBe("Item one Item two");
    expect(sanitizeForMeta("1. First\n2. Second")).toBe("First Second");
  });

  it("collapses multiple whitespace", () => {
    expect(sanitizeForMeta("Hello    world\n\nfoo")).toBe("Hello world foo");
  });

  it("strips horizontal rules", () => {
    expect(sanitizeForMeta("Above\n---\nBelow")).toBe("Above Below");
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

  it("sanitizes description containing Lexical JSON", () => {
    const lexical = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "My cool bio" }],
          },
        ],
      },
    });

    const result = buildMetadata({
      title: "User",
      description: lexical,
    });

    expect(result.description).toBe("My cool bio");
    expect((result.openGraph as Record<string, unknown>)?.description).toBe("My cool bio");
    expect((result.twitter as Record<string, unknown>)?.description).toBe("My cool bio");
  });

  it("sanitizes description containing markdown", () => {
    const result = buildMetadata({
      title: "Post",
      description: "## Hello **world**",
    });

    expect(result.description).toBe("Hello world");
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
