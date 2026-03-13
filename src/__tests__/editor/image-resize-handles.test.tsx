import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Lexical hooks
const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn(),
  isEditable: vi.fn().mockReturnValue(true),
};

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

vi.mock("@lexical/react/useLexicalNodeSelection", () => ({
  useLexicalNodeSelection: () => [true, vi.fn(), vi.fn()],
}));

vi.mock("@lexical/utils", () => ({
  mergeRegister: (...args: (() => void)[]) => {
    return () => args.forEach((fn) => fn());
  },
}));

vi.mock("lexical", () => ({
  $getNodeByKey: vi.fn(),
  $getSelection: vi.fn(),
  $isNodeSelection: vi.fn(),
  CLICK_COMMAND: "CLICK_COMMAND",
  COMMAND_PRIORITY_LOW: 0,
  KEY_BACKSPACE_COMMAND: "KEY_BACKSPACE_COMMAND",
  KEY_DELETE_COMMAND: "KEY_DELETE_COMMAND",
}));

vi.mock("@/components/editor/nodes/ImageNode", () => ({
  $isImageNode: vi.fn().mockReturnValue(true),
}));

import ImageComponent from "@/components/editor/nodes/ImageComponent";

describe("ImageComponent resize handles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders all 4 resize handles when selected and editable", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.getByTestId("resize-handle-se")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle-sw")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle-ne")).toBeInTheDocument();
    expect(screen.getByTestId("resize-handle-nw")).toBeInTheDocument();
  });

  it("has correct cursor classes for each handle", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.getByTestId("resize-handle-se").className).toContain("cursor-se-resize");
    expect(screen.getByTestId("resize-handle-sw").className).toContain("cursor-sw-resize");
    expect(screen.getByTestId("resize-handle-ne").className).toContain("cursor-ne-resize");
    expect(screen.getByTestId("resize-handle-nw").className).toContain("cursor-nw-resize");
  });

  it("does not render handles when not editable", () => {
    mockEditor.isEditable.mockReturnValue(false);

    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.queryByTestId("resize-handle-se")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-handle-sw")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-handle-ne")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-handle-nw")).not.toBeInTheDocument();
  });

  it("handles have correct positioning classes", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const se = screen.getByTestId("resize-handle-se");
    const sw = screen.getByTestId("resize-handle-sw");
    const ne = screen.getByTestId("resize-handle-ne");
    const nw = screen.getByTestId("resize-handle-nw");

    // SE: bottom-right
    expect(se.className).toContain("-right-1");
    expect(se.className).toContain("-bottom-1");

    // SW: bottom-left
    expect(sw.className).toContain("-left-1");
    expect(sw.className).toContain("-bottom-1");

    // NE: top-right
    expect(ne.className).toContain("-right-1");
    expect(ne.className).toContain("-top-1");

    // NW: top-left
    expect(nw.className).toContain("-left-1");
    expect(nw.className).toContain("-top-1");
  });
});
