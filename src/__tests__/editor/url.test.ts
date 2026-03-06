import { describe, it, expect } from "vitest";
import { extractYouTubeVideoID, isValidUrl } from "@/components/editor/utils/url";

describe("extractYouTubeVideoID", () => {
  it("extracts ID from standard watch URLs", () => {
    expect(extractYouTubeVideoID("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoID("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoID("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from short youtu.be URLs", () => {
    expect(extractYouTubeVideoID("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from embed URLs", () => {
    expect(extractYouTubeVideoID("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from shorts URLs", () => {
    expect(extractYouTubeVideoID("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoID("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeVideoID("https://example.com")).toBeNull();
    expect(extractYouTubeVideoID("not a url")).toBeNull();
  });

  it("returns null for YouTube URLs without valid video ID", () => {
    expect(extractYouTubeVideoID("https://www.youtube.com/")).toBeNull();
    expect(extractYouTubeVideoID("https://www.youtube.com/feed/trending")).toBeNull();
  });

  it("handles IDs with hyphens and underscores", () => {
    expect(extractYouTubeVideoID("https://youtu.be/abc-_12DEfG")).toBe("abc-_12DEfG");
  });
});

describe("isValidUrl", () => {
  it("returns true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("https://sub.domain.com/path?q=1")).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false);
  });
});
