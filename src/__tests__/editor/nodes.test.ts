import { describe, it, expect, beforeEach } from "vitest";
import { createEditor, type LexicalEditor } from "lexical";
import { ImageNode } from "@/components/editor/nodes/ImageNode";
import { YouTubeNode } from "@/components/editor/nodes/YouTubeNode";
import { EquationNode } from "@/components/editor/nodes/EquationNode";
import { PageBreakNode } from "@/components/editor/nodes/PageBreakNode";
import { DateNode } from "@/components/editor/nodes/DateNode";
import { StickyNoteNode } from "@/components/editor/nodes/StickyNoteNode";
import { PollNode } from "@/components/editor/nodes/PollNode";

import { VideoNode } from "@/components/editor/nodes/VideoNode";
import { FileNode } from "@/components/editor/nodes/FileNode";
import { MentionNode } from "@/components/editor/nodes/MentionNode";

const allNodes = [
  ImageNode,
  YouTubeNode,
  EquationNode,
  PageBreakNode,
  DateNode,
  StickyNoteNode,
  PollNode,

  VideoNode,
  FileNode,
  MentionNode,
];

function createTestEditor(): LexicalEditor {
  const editor = createEditor({
    nodes: allNodes,
    onError: (e) => {
      throw e;
    },
  });
  editor.setRootElement(document.createElement("div"));
  return editor;
}

/**
 * Run a function inside an editor update context (synchronous via discrete mode).
 * Lexical nodes can only be instantiated inside an active editor context.
 */
function withEditor<T>(editor: LexicalEditor, fn: () => T): T {
  let result: T;
  editor.update(
    () => {
      result = fn();
    },
    { discrete: true }
  );
  return result!;
}

describe("ImageNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(ImageNode.getType()).toBe("image");
  });

  it("serializes and deserializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new ImageNode(
        "https://example.com/img.jpg",
        "Test image",
        400,
        300,
        "Caption"
      );
      return node.exportJSON();
    });

    expect(json.type).toBe("image");
    expect(json.src).toBe("https://example.com/img.jpg");
    expect(json.altText).toBe("Test image");
    expect(json.width).toBe(400);
    expect(json.height).toBe(300);
    expect(json.caption).toBe("Caption");

    const restoredJson = withEditor(editor, () => {
      const restored = ImageNode.importJSON(json);
      return restored.exportJSON();
    });
    expect(restoredJson).toEqual(json);
  });

  it("defaults width/height to inherit", () => {
    const json = withEditor(editor, () => {
      const node = new ImageNode("https://example.com/img.jpg", "Test");
      return node.exportJSON();
    });
    expect(json.width).toBe("inherit");
    expect(json.height).toBe("inherit");
  });
});

describe("YouTubeNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(YouTubeNode.getType()).toBe("youtube");
  });

  it("serializes and deserializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new YouTubeNode("dQw4w9WgXcQ");
      return node.exportJSON();
    });

    expect(json.type).toBe("youtube");
    expect(json.videoID).toBe("dQw4w9WgXcQ");

    const videoID = withEditor(editor, () => {
      const restored = YouTubeNode.importJSON(json);
      return restored.getVideoID();
    });
    expect(videoID).toBe("dQw4w9WgXcQ");
  });

  it("exports to DOM with iframe", () => {
    withEditor(editor, () => {
      const node = new YouTubeNode("dQw4w9WgXcQ");
      const { element } = node.exportDOM();
      expect(element).toBeTruthy();
      const iframe = (element as HTMLElement).querySelector("iframe");
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute("src")).toContain("dQw4w9WgXcQ");
    });
  });
});

describe("EquationNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(EquationNode.getType()).toBe("equation");
  });

  it("serializes inline and block equations", () => {
    const inlineJson = withEditor(editor, () => {
      return new EquationNode("E = mc^2", true).exportJSON();
    });
    const blockJson = withEditor(editor, () => {
      return new EquationNode("\\sum_{i=0}^n x_i", false).exportJSON();
    });

    expect(inlineJson.inline).toBe(true);
    expect(inlineJson.equation).toBe("E = mc^2");

    expect(blockJson.inline).toBe(false);
    expect(blockJson.equation).toBe("\\sum_{i=0}^n x_i");
  });

  it("can read equation text", () => {
    const eq = withEditor(editor, () => {
      const node = new EquationNode("x^2", true);
      return node.getEquation();
    });
    expect(eq).toBe("x^2");
  });
});

describe("PageBreakNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(PageBreakNode.getType()).toBe("page-break");
  });

  it("serializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new PageBreakNode();
      return node.exportJSON();
    });
    expect(json.type).toBe("page-break");
    expect(json.version).toBe(1);
  });
});

describe("DateNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(DateNode.getType()).toBe("date");
  });

  it("stores date string", () => {
    const json = withEditor(editor, () => {
      const node = new DateNode("March 5, 2026");
      return node.exportJSON();
    });
    expect(json.type).toBe("date");
    expect(json.date).toBe("March 5, 2026");
  });

  it("is inline", () => {
    const isInline = withEditor(editor, () => {
      const node = new DateNode("March 5, 2026");
      return node.isInline();
    });
    expect(isInline).toBe(true);
  });
});

describe("StickyNoteNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(StickyNoteNode.getType()).toBe("sticky-note");
  });

  it("serializes with text and color", () => {
    const json = withEditor(editor, () => {
      const node = new StickyNoteNode("Remember this!", "pink");
      return node.exportJSON();
    });
    expect(json.type).toBe("sticky-note");
    expect(json.text).toBe("Remember this!");
    expect(json.color).toBe("pink");
  });

  it("defaults to yellow and empty text", () => {
    const json = withEditor(editor, () => {
      const node = new StickyNoteNode();
      return node.exportJSON();
    });
    expect(json.color).toBe("yellow");
    expect(json.text).toBe("");
  });
});

describe("PollNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(PollNode.getType()).toBe("poll");
  });

  it("serializes with question, options, and no expiry", () => {
    const options = [
      { id: "1", text: "Option A", votes: 0 },
      { id: "2", text: "Option B", votes: 3 },
    ];
    const json = withEditor(editor, () => {
      const node = new PollNode("What's your favorite?", options);
      return node.exportJSON();
    });
    expect(json.type).toBe("poll");
    expect(json.version).toBe(2);
    expect(json.question).toBe("What's your favorite?");
    expect(json.options).toHaveLength(2);
    expect(json.options[1].votes).toBe(3);
    expect(json.expiresAt).toBeNull();
  });

  it("serializes with expiresAt", () => {
    const options = [
      { id: "1", text: "Yes", votes: 0 },
      { id: "2", text: "No", votes: 0 },
    ];
    const deadline = "2026-12-31T23:59:59.000Z";
    const json = withEditor(editor, () => {
      const node = new PollNode("Keep it?", options, deadline);
      return node.exportJSON();
    });
    expect(json.expiresAt).toBe(deadline);
    expect(json.version).toBe(2);
  });

  it("round-trips through importJSON/exportJSON", () => {
    const options = [
      { id: "1", text: "A", votes: 0 },
      { id: "2", text: "B", votes: 0 },
    ];
    const deadline = "2026-06-15T12:00:00.000Z";
    const json = withEditor(editor, () => {
      const node = new PollNode("Test?", options, deadline);
      return node.exportJSON();
    });
    const restoredJson = withEditor(editor, () => {
      const restored = PollNode.importJSON(json);
      return restored.exportJSON();
    });
    expect(restoredJson).toEqual(json);
  });

  it("handles v1 JSON without expiresAt (backward compat)", () => {
    const v1Json = {
      type: "poll",
      version: 1,
      question: "Old poll?",
      options: [
        { id: "1", text: "A", votes: 1 },
        { id: "2", text: "B", votes: 2 },
      ],
    } as any;

    const json = withEditor(editor, () => {
      const node = PollNode.importJSON(v1Json);
      return node.exportJSON();
    });
    expect(json.expiresAt).toBeNull();
    expect(json.version).toBe(2);
    expect(json.question).toBe("Old poll?");
  });

  it("reports expiresAt via getter", () => {
    const pastDate = "2020-01-01T00:00:00.000Z";
    const expiresAt = withEditor(editor, () => {
      const node = new PollNode(
        "Done?",
        [
          { id: "1", text: "A", votes: 0 },
          { id: "2", text: "B", votes: 0 },
        ],
        pastDate
      );
      return node.getExpiresAt();
    });
    expect(expiresAt).toBe(pastDate);
  });
});


describe("VideoNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(VideoNode.getType()).toBe("video");
  });

  it("serializes and deserializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new VideoNode(
        "https://example.com/video.mp4",
        "video.mp4",
        "video/mp4"
      );
      return node.exportJSON();
    });

    expect(json.type).toBe("video");
    expect(json.src).toBe("https://example.com/video.mp4");
    expect(json.fileName).toBe("video.mp4");
    expect(json.mimeType).toBe("video/mp4");

    const restoredJson = withEditor(editor, () => {
      const restored = VideoNode.importJSON(json);
      return restored.exportJSON();
    });
    expect(restoredJson).toEqual(json);
  });

  it("exports to DOM with video element", () => {
    withEditor(editor, () => {
      const node = new VideoNode(
        "https://example.com/video.mp4",
        "video.mp4",
        "video/mp4"
      );
      const { element } = node.exportDOM();
      expect(element).toBeTruthy();
      expect((element as HTMLElement).tagName).toBe("VIDEO");
      expect((element as HTMLElement).getAttribute("src")).toBe(
        "https://example.com/video.mp4"
      );
      expect((element as HTMLElement).getAttribute("controls")).toBe("true");
    });
  });
});

describe("FileNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(FileNode.getType()).toBe("file");
  });

  it("serializes and deserializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new FileNode(
        "https://example.com/doc.pdf",
        "doc.pdf",
        102400,
        "application/pdf"
      );
      return node.exportJSON();
    });

    expect(json.type).toBe("file");
    expect(json.src).toBe("https://example.com/doc.pdf");
    expect(json.fileName).toBe("doc.pdf");
    expect(json.fileSize).toBe(102400);
    expect(json.mimeType).toBe("application/pdf");

    const restoredJson = withEditor(editor, () => {
      const restored = FileNode.importJSON(json);
      return restored.exportJSON();
    });
    expect(restoredJson).toEqual(json);
  });

  it("exports to DOM with download link", () => {
    withEditor(editor, () => {
      const node = new FileNode(
        "https://example.com/doc.pdf",
        "doc.pdf",
        102400,
        "application/pdf"
      );
      const { element } = node.exportDOM();
      expect(element).toBeTruthy();
      expect((element as HTMLElement).tagName).toBe("A");
      expect((element as HTMLAnchorElement).getAttribute("href")).toBe(
        "https://example.com/doc.pdf"
      );
      expect((element as HTMLAnchorElement).getAttribute("download")).toBe(
        "doc.pdf"
      );
      expect((element as HTMLElement).textContent).toBe("doc.pdf");
    });
  });
});

describe("MentionNode", () => {
  let editor: LexicalEditor;
  beforeEach(() => {
    editor = createTestEditor();
  });

  it("has correct type", () => {
    expect(MentionNode.getType()).toBe("mention");
  });

  it("serializes and deserializes correctly", () => {
    const json = withEditor(editor, () => {
      const node = new MentionNode("alice", "user-123");
      return node.exportJSON();
    });

    expect(json.type).toBe("mention");
    expect(json.username).toBe("alice");
    expect(json.userId).toBe("user-123");
    expect(json.version).toBe(1);

    const restoredJson = withEditor(editor, () => {
      const restored = MentionNode.importJSON(json);
      return restored.exportJSON();
    });
    expect(restoredJson).toEqual(json);
  });

  it("is inline", () => {
    const isInline = withEditor(editor, () => {
      const node = new MentionNode("alice", "user-123");
      return node.isInline();
    });
    expect(isInline).toBe(true);
  });

  it("exports to DOM with username data attributes", () => {
    withEditor(editor, () => {
      const node = new MentionNode("alice", "user-123");
      const { element } = node.exportDOM();
      expect(element).toBeTruthy();
      expect((element as HTMLElement).textContent).toBe("@alice");
      expect(
        (element as HTMLElement).getAttribute("data-mention-username")
      ).toBe("alice");
      expect(
        (element as HTMLElement).getAttribute("data-mention-user-id")
      ).toBe("user-123");
    });
  });
});

describe("editorNodes registry", () => {
  it("exports all node types", async () => {
    const { editorNodes } = await import("@/components/editor/nodes");
    expect(editorNodes.length).toBeGreaterThanOrEqual(14);

    const types = editorNodes.map((n) => n.getType());
    expect(types).toContain("image");
    expect(types).toContain("youtube");
    expect(types).toContain("equation");
    expect(types).toContain("page-break");
    expect(types).toContain("date");
    expect(types).toContain("sticky-note");
    expect(types).toContain("poll");

    expect(types).toContain("heading");
    expect(types).toContain("quote");
    expect(types).toContain("code");
    expect(types).toContain("link");
    expect(types).toContain("table");
    expect(types).toContain("horizontalrule");
    expect(types).toContain("video");
    expect(types).toContain("file");
    expect(types).toContain("mention");
    expect(types).toContain("list");
    expect(types).toContain("listitem");
    // collapsible-container should no longer be registered
    expect(types).not.toContain("collapsible-container");
    expect(types).not.toContain("collapsible-title");
    expect(types).not.toContain("collapsible-content");
  });
});
