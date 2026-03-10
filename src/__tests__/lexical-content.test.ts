import { describe, it, expect } from "vitest";
import { extractContentFromLexicalJson } from "@/lib/lexical-text";

function makeLexical(children: unknown[]) {
  return JSON.stringify({
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makeParagraph(children: unknown[]) {
  return {
    children,
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
  };
}

function makeTextNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text,
    type: "text",
    version: 1,
  };
}

function makeMentionNode(username: string) {
  return {
    type: "mention",
    username,
    version: 1,
  };
}

function makeImageNode(
  src: string,
  altText?: string,
  caption?: string
) {
  return {
    type: "image",
    src,
    altText: altText ?? "",
    caption: caption ?? "",
    width: "inherit" as const,
    height: "inherit" as const,
    version: 1,
  };
}

describe("extractContentFromLexicalJson", () => {
  it("extracts text from paragraphs", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Hello world")]),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("Hello world");
    expect(result.imageUrls).toEqual([]);
  });

  it("extracts text from multiple paragraphs", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("First")]),
      makeParagraph([makeTextNode("Second")]),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("First Second");
  });

  it("extracts image URLs from image nodes", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Check this out")]),
      makeImageNode("https://example.com/photo.jpg"),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.imageUrls).toEqual(["https://example.com/photo.jpg"]);
  });

  it("includes image altText and caption in text output", () => {
    const json = makeLexical([
      makeImageNode(
        "https://example.com/sunset.jpg",
        "A beautiful sunset",
        "Taken at the beach"
      ),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("A beautiful sunset Taken at the beach");
    expect(result.imageUrls).toEqual(["https://example.com/sunset.jpg"]);
  });

  it("handles mixed text and image content", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Look at this photo")]),
      makeImageNode("https://example.com/photo1.jpg", "Photo one"),
      makeParagraph([makeTextNode("And this one")]),
      makeImageNode("https://example.com/photo2.jpg", "Photo two"),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe(
      "Look at this photo Photo one And this one Photo two"
    );
    expect(result.imageUrls).toEqual([
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
    ]);
  });

  it("handles nested structures with images", () => {
    const json = makeLexical([
      {
        type: "list",
        children: [
          {
            type: "listitem",
            children: [makeTextNode("Item with image")],
          },
        ],
      },
      makeImageNode("https://example.com/nested.jpg"),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("Item with image");
    expect(result.imageUrls).toEqual(["https://example.com/nested.jpg"]);
  });

  it("extracts mention usernames in text", () => {
    const json = makeLexical([
      makeParagraph([
        makeTextNode("Hey "),
        makeMentionNode("alice"),
      ]),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("Hey  @alice");
  });

  it("returns empty content for invalid JSON", () => {
    const result = extractContentFromLexicalJson("not valid json");
    expect(result.text).toBe("");
    expect(result.imageUrls).toEqual([]);
  });

  it("returns empty content for JSON without root", () => {
    const result = extractContentFromLexicalJson(
      JSON.stringify({ foo: "bar" })
    );
    expect(result.text).toBe("");
    expect(result.imageUrls).toEqual([]);
  });

  it("returns empty content for empty document", () => {
    const json = makeLexical([]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("");
    expect(result.imageUrls).toEqual([]);
  });

  it("handles document with only images and no text", () => {
    const json = makeLexical([
      makeImageNode("https://example.com/a.jpg"),
      makeImageNode("https://example.com/b.jpg"),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.imageUrls).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  });

  it("handles document with only text and no images", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Just text")]),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("Just text");
    expect(result.imageUrls).toEqual([]);
  });

  it("skips empty altText and caption", () => {
    const json = makeLexical([
      makeImageNode("https://example.com/photo.jpg", "", ""),
    ]);
    const result = extractContentFromLexicalJson(json);
    expect(result.text).toBe("");
    expect(result.imageUrls).toEqual(["https://example.com/photo.jpg"]);
  });
});
