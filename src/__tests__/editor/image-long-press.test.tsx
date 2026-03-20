import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  isEditable: vi.fn().mockReturnValue(true),
  getRootElement: vi.fn().mockReturnValue({ clientWidth: 600 }),
};

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

vi.mock("@lexical/react/useLexicalNodeSelection", () => ({
  useLexicalNodeSelection: () => [false, vi.fn(), vi.fn()],
}));

vi.mock("@lexical/utils", () => ({
  mergeRegister: (...args: (() => void)[]) => {
    return () => args.forEach((fn) => fn());
  },
}));

vi.mock("lexical", () => ({
  $getNodeByKey: vi.fn(() => ({
    setWidthAndHeight: vi.fn(),
    setAltText: vi.fn(),
  })),
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

describe("Image component (no context menu)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("does not render a context menu (replaced by sidebar)", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    // Context menu was removed in the sidebar refactor
    expect(screen.queryByTestId("image-context-menu")).not.toBeInTheDocument();
  });

  it("does not render sidebar when not selected", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    // isSelected is mocked as false, so sidebar should not appear
    expect(screen.queryByTestId("image-sidebar")).not.toBeInTheDocument();
  });

  it("does not render sidebar when editor is not editable", () => {
    mockEditor.isEditable.mockReturnValue(false);

    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    expect(screen.queryByTestId("image-sidebar")).not.toBeInTheDocument();
  });
});
