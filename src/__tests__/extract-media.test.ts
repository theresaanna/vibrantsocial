import { describe, it, expect } from "vitest";
import { extractMediaFromLexicalJson } from "@/lib/lexical-text";

function makeLexicalJson(children: unknown[]) {
  return JSON.stringify({
    root: {
      children,
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

describe("extractMediaFromLexicalJson", () => {
  it("extracts image nodes", () => {
    const json = makeLexicalJson([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://example.com/photo.jpg",
            altText: "A photo",
            width: 800,
            height: 600,
            version: 1,
          },
        ],
      },
    ]);

    const media = extractMediaFromLexicalJson(json);
    expect(media).toHaveLength(1);
    expect(media[0]).toEqual({
      type: "image",
      src: "https://example.com/photo.jpg",
      altText: "A photo",
      width: 800,
      height: 600,
    });
  });

  it("extracts video nodes", () => {
    const json = makeLexicalJson([
      {
        type: "paragraph",
        children: [
          {
            type: "video",
            src: "https://example.com/clip.mp4",
            fileName: "clip.mp4",
            mimeType: "video/mp4",
            version: 1,
          },
        ],
      },
    ]);

    const media = extractMediaFromLexicalJson(json);
    expect(media).toHaveLength(1);
    expect(media[0]).toEqual({
      type: "video",
      src: "https://example.com/clip.mp4",
      fileName: "clip.mp4",
      mimeType: "video/mp4",
    });
  });

  it("extracts YouTube nodes", () => {
    const json = makeLexicalJson([
      {
        type: "youtube",
        videoID: "dQw4w9WgXcQ",
        version: 1,
      },
    ]);

    const media = extractMediaFromLexicalJson(json);
    expect(media).toHaveLength(1);
    expect(media[0]).toEqual({
      type: "youtube",
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoID: "dQw4w9WgXcQ",
    });
  });

  it("extracts multiple media from nested nodes", () => {
    const json = makeLexicalJson([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Check out these:" },
          { type: "image", src: "https://example.com/1.jpg", altText: "First", width: "inherit", height: "inherit", version: 1 },
        ],
      },
      {
        type: "paragraph",
        children: [
          { type: "image", src: "https://example.com/2.jpg", altText: "Second", width: 400, height: 300, version: 1 },
          { type: "video", src: "https://example.com/v.mp4", fileName: "v.mp4", mimeType: "video/mp4", version: 1 },
        ],
      },
    ]);

    const media = extractMediaFromLexicalJson(json);
    expect(media).toHaveLength(3);
    expect(media[0].type).toBe("image");
    expect(media[1].type).toBe("image");
    expect(media[2].type).toBe("video");
  });

  it("returns empty array for text-only content", () => {
    const json = makeLexicalJson([
      {
        type: "paragraph",
        children: [{ type: "text", text: "Just text here" }],
      },
    ]);

    expect(extractMediaFromLexicalJson(json)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(extractMediaFromLexicalJson("not json")).toEqual([]);
  });

  it("returns empty array for empty content", () => {
    expect(extractMediaFromLexicalJson("")).toEqual([]);
  });

  it("handles image without optional fields", () => {
    const json = makeLexicalJson([
      {
        type: "image",
        src: "https://example.com/bare.jpg",
        version: 1,
      },
    ]);

    const media = extractMediaFromLexicalJson(json);
    expect(media).toHaveLength(1);
    expect(media[0]).toEqual({
      type: "image",
      src: "https://example.com/bare.jpg",
      altText: undefined,
      width: undefined,
      height: undefined,
    });
  });
});
