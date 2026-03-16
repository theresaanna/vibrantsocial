import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetWidthAndHeight = vi.fn();
const mockSetAltText = vi.fn();

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  isEditable: vi.fn().mockReturnValue(true),
};

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

const mockSetSelected = vi.fn();
const mockClearSelection = vi.fn();

vi.mock("@lexical/react/useLexicalNodeSelection", () => ({
  useLexicalNodeSelection: () => [true, mockSetSelected, mockClearSelection],
}));

vi.mock("@lexical/utils", () => ({
  mergeRegister: (...args: (() => void)[]) => {
    return () => args.forEach((fn) => fn());
  },
}));

vi.mock("lexical", () => ({
  $getNodeByKey: vi.fn(() => ({
    setWidthAndHeight: mockSetWidthAndHeight,
    setAltText: mockSetAltText,
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

describe("Image action toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders toolbar when image is selected and editable", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.getByTestId("image-action-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-resize-button")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-alt-text-button")).toBeInTheDocument();
  });

  it("does not render toolbar when editor is not editable", () => {
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

    expect(screen.queryByTestId("image-action-toolbar")).not.toBeInTheDocument();
  });

  it("opens resize popover when resize button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    await user.click(screen.getByTestId("toolbar-resize-button"));

    expect(screen.getByTestId("image-resize-popover")).toBeInTheDocument();
  });

  it("opens alt text popover when alt text button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    await user.click(screen.getByTestId("toolbar-alt-text-button"));

    expect(screen.getByTestId("alt-text-popover")).toBeInTheDocument();
  });
});
