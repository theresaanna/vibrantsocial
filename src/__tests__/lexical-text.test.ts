import { describe, it, expect } from "vitest";
import { extractTextFromLexicalJson, extractHashtagsFromLexicalJson } from "@/lib/lexical-text";

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

describe("extractTextFromLexicalJson", () => {
  it("extracts text from a simple paragraph", () => {
    const json = makeLexical([makeParagraph([makeTextNode("Hello world")])]);
    expect(extractTextFromLexicalJson(json)).toBe("Hello world");
  });

  it("extracts text from multiple paragraphs", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("First paragraph")]),
      makeParagraph([makeTextNode("Second paragraph")]),
    ]);
    expect(extractTextFromLexicalJson(json)).toBe(
      "First paragraph Second paragraph"
    );
  });

  it("extracts text from multiple text nodes in one paragraph", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Hello "), makeTextNode("world")]),
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("Hello  world");
  });

  it("extracts mention usernames as @username", () => {
    const json = makeLexical([
      makeParagraph([
        makeTextNode("Hey "),
        makeMentionNode("alice"),
        makeTextNode(" check this out"),
      ]),
    ]);
    expect(extractTextFromLexicalJson(json)).toBe(
      "Hey  @alice  check this out"
    );
  });

  it("handles nested structures like lists", () => {
    const json = makeLexical([
      {
        type: "list",
        children: [
          {
            type: "listitem",
            children: [makeTextNode("Item one")],
          },
          {
            type: "listitem",
            children: [makeTextNode("Item two")],
          },
        ],
      },
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("Item one Item two");
  });

  it("returns empty string for invalid JSON", () => {
    expect(extractTextFromLexicalJson("not valid json")).toBe("");
  });

  it("returns empty string for JSON without root", () => {
    expect(extractTextFromLexicalJson(JSON.stringify({ foo: "bar" }))).toBe("");
  });

  it("returns empty string for empty document", () => {
    const json = makeLexical([]);
    expect(extractTextFromLexicalJson(json)).toBe("");
  });

  it("handles nodes without text property gracefully", () => {
    const json = makeLexical([
      makeParagraph([
        { type: "linebreak", version: 1 },
        makeTextNode("After break"),
      ]),
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("After break");
  });

  it("extracts text from a numbered list", () => {
    const json = makeLexical([
      {
        type: "list",
        listType: "number",
        children: [
          { type: "listitem", children: [makeTextNode("First")] },
          { type: "listitem", children: [makeTextNode("Second")] },
          { type: "listitem", children: [makeTextNode("Third")] },
        ],
      },
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("First Second Third");
  });

  it("extracts text from checklist items", () => {
    const json = makeLexical([
      {
        type: "list",
        listType: "check",
        children: [
          { type: "listitem", checked: true, children: [makeTextNode("Done task")] },
          { type: "listitem", checked: false, children: [makeTextNode("Pending task")] },
        ],
      },
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("Done task Pending task");
  });

  it("extracts text from nested lists", () => {
    const json = makeLexical([
      {
        type: "list",
        listType: "bullet",
        children: [
          { type: "listitem", children: [makeTextNode("Parent item")] },
          {
            type: "listitem",
            children: [
              {
                type: "list",
                listType: "bullet",
                children: [
                  { type: "listitem", children: [makeTextNode("Child item")] },
                ],
              },
            ],
          },
        ],
      },
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("Parent item Child item");
  });

  it("extracts text from mixed paragraph and list content", () => {
    const json = makeLexical([
      makeParagraph([makeTextNode("Intro text")]),
      {
        type: "list",
        listType: "bullet",
        children: [
          { type: "listitem", children: [makeTextNode("Item A")] },
          { type: "listitem", children: [makeTextNode("Item B")] },
        ],
      },
      makeParagraph([makeTextNode("Outro text")]),
    ]);
    expect(extractTextFromLexicalJson(json)).toBe(
      "Intro text Item A Item B Outro text"
    );
  });

  it("handles deeply nested content", () => {
    const json = makeLexical([
      {
        type: "quote",
        children: [
          makeParagraph([
            {
              type: "link",
              children: [makeTextNode("linked text")],
              url: "https://example.com",
            },
          ]),
        ],
      },
    ]);
    expect(extractTextFromLexicalJson(json)).toBe("linked text");
  });
});

function makeHashtagNode(tagName: string) {
  return { type: "hashtag", tagName, version: 1 };
}

describe("extractHashtagsFromLexicalJson", () => {
  it("extracts hashtags from a paragraph", () => {
    const json = makeLexical([
      makeParagraph([
        makeTextNode("hello "),
        makeHashtagNode("gaming"),
        makeTextNode(" world"),
      ]),
    ]);
    expect(extractHashtagsFromLexicalJson(json)).toEqual(["gaming"]);
  });

  it("extracts multiple unique hashtags", () => {
    const json = makeLexical([
      makeParagraph([
        makeHashtagNode("music"),
        makeTextNode(" and "),
        makeHashtagNode("art"),
      ]),
    ]);
    expect(extractHashtagsFromLexicalJson(json)).toEqual(["music", "art"]);
  });

  it("deduplicates hashtags", () => {
    const json = makeLexical([
      makeParagraph([makeHashtagNode("gaming")]),
      makeParagraph([makeHashtagNode("gaming")]),
    ]);
    expect(extractHashtagsFromLexicalJson(json)).toEqual(["gaming"]);
  });

  it("returns empty array for content without hashtags", () => {
    const json = makeLexical([makeParagraph([makeTextNode("no tags here")])]);
    expect(extractHashtagsFromLexicalJson(json)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(extractHashtagsFromLexicalJson("not json")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractHashtagsFromLexicalJson("")).toEqual([]);
  });
});
