import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetWidthAndHeight = vi.fn();
const mockSetAltText = vi.fn();

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  isEditable: vi.fn().mockReturnValue(true),
  getRootElement: vi.fn().mockReturnValue({ clientWidth: 600 }),
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

describe("Image sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders sidebar when image is selected and editable", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.getByTestId("image-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-resize-button")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-alt-text-button")).toBeInTheDocument();
  });

  it("does not render sidebar when editor is not editable", () => {
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

    expect(screen.queryByTestId("image-sidebar")).not.toBeInTheDocument();
  });

  it("opens resize modal when resize button is clicked", async () => {
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

    await user.click(screen.getByTestId("sidebar-resize-button"));

    expect(screen.getByTestId("resize-width-input")).toBeInTheDocument();
    expect(screen.getByTestId("resize-height-input")).toBeInTheDocument();
  });

  it("opens alt text modal when alt text button is clicked", async () => {
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

    await user.click(screen.getByTestId("sidebar-alt-text-button"));

    expect(screen.getByTestId("alt-text-input")).toBeInTheDocument();
  });
});
