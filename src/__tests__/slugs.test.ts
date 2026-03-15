import { describe, it, expect } from "vitest";
import {
  generateSlug,
  generateSlugFromContent,
  validateSlug,
} from "@/lib/slugs";

describe("generateSlug", () => {
  it("converts text to lowercase hyphenated slug", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(generateSlug("Hello! @World #2024")).toBe("hello-world-2024");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("collapses multiple spaces", () => {
    expect(generateSlug("hello   world")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(generateSlug("  -hello world-  ")).toBe("hello-world");
  });

  it("truncates to 60 characters at word boundary", () => {
    const longText =
      "this is a very long post title that should be truncated at a word boundary to avoid ugly urls";
    const slug = generateSlug(longText);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });

  it("returns empty string for empty input", () => {
    expect(generateSlug("")).toBe("");
  });

  it("returns empty string for only special characters", () => {
    expect(generateSlug("!@#$%^&*()")).toBe("");
  });

  it("preserves numbers", () => {
    expect(generateSlug("Top 10 Tips for 2024")).toBe("top-10-tips-for-2024");
  });

  it("handles single word", () => {
    expect(generateSlug("hello")).toBe("hello");
  });

  it("handles mixed case", () => {
    expect(generateSlug("CamelCase AND UPPERCASE")).toBe(
      "camelcase-and-uppercase"
    );
  });

  it("handles content with mentions", () => {
    expect(generateSlug("Hey @alice check this out")).toBe(
      "hey-alice-check-this-out"
    );
  });

  it("does not truncate mid-word when close to limit", () => {
    // 60+ chars where a word crosses the boundary
    const text = "abcdefghij abcdefghij abcdefghij abcdefghij abcdefghij abcdefghij extra";
    const slug = generateSlug(text);
    expect(slug.length).toBeLessThanOrEqual(60);
    // Should truncate at word boundary (last hyphen before 60 chars)
    expect(slug).toBe("abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij");
  });
});

describe("generateSlugFromContent", () => {
  it("generates slug from Lexical JSON content", () => {
    const lexicalJson = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "My First Post" }],
          },
        ],
      },
    });
    expect(generateSlugFromContent(lexicalJson)).toBe("my-first-post");
  });

  it("generates slug from multi-paragraph content", () => {
    const lexicalJson = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Title here" }],
          },
          {
            type: "paragraph",
            children: [{ type: "text", text: "More content follows" }],
          },
        ],
      },
    });
    expect(generateSlugFromContent(lexicalJson)).toBe(
      "title-here-more-content-follows"
    );
  });

  it("returns empty string for invalid JSON", () => {
    expect(generateSlugFromContent("not json")).toBe("");
  });

  it("returns empty string for empty content", () => {
    const lexicalJson = JSON.stringify({
      root: { children: [] },
    });
    expect(generateSlugFromContent(lexicalJson)).toBe("");
  });

  it("handles content with mentions", () => {
    const lexicalJson = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Hey " },
              { type: "mention", username: "alice" },
              { type: "text", text: " check this" },
            ],
          },
        ],
      },
    });
    expect(generateSlugFromContent(lexicalJson)).toBe(
      "hey-alice-check-this"
    );
  });
});

describe("validateSlug", () => {
  it("normalizes a valid slug", () => {
    expect(validateSlug("My-Post-Title")).toBe("my-post-title");
  });

  it("converts spaces to hyphens and strips invalid characters", () => {
    expect(validateSlug("hello world!")).toBe("hello-world");
  });

  it("preserves hyphens", () => {
    expect(validateSlug("my-custom-slug")).toBe("my-custom-slug");
  });

  it("collapses consecutive hyphens", () => {
    expect(validateSlug("hello---world")).toBe("hello-world");
  });

  it("strips leading/trailing hyphens", () => {
    expect(validateSlug("-hello-world-")).toBe("hello-world");
  });

  it("truncates to 60 characters", () => {
    const long = "a-".repeat(50);
    expect(validateSlug(long).length).toBeLessThanOrEqual(60);
  });

  it("returns empty string for empty input", () => {
    expect(validateSlug("")).toBe("");
  });

  it("returns empty string for only invalid characters", () => {
    expect(validateSlug("!@# $%^")).toBe("");
  });

  it("preserves numbers", () => {
    expect(validateSlug("post-123")).toBe("post-123");
  });
});
