import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  isEditable: vi.fn().mockReturnValue(false),
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

const defaultProps = {
  src: "https://example.com/large-photo.jpg",
  altText: "Large photo",
  width: 2000 as number | "inherit",
  height: 1500 as number | "inherit",
  nodeKey: "test-key",
};

describe("ImageComponent display mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(false);
  });

  it("constrains image to max 1000px in display mode", () => {
    render(<ImageComponent {...defaultProps} />);
    const img = screen.getByTestId("editor-image");
    expect(img.style.maxWidth).toBe("1000px");
    expect(img.style.maxHeight).toBe("1000px");
  });

  it("shows zoom-in cursor in display mode", () => {
    render(<ImageComponent {...defaultProps} />);
    const img = screen.getByTestId("editor-image");
    expect(img.style.cursor).toBe("zoom-in");
  });

  it("does not constrain image in edit mode", () => {
    mockEditor.isEditable.mockReturnValue(true);
    render(<ImageComponent {...defaultProps} />);
    const img = screen.getByTestId("editor-image");
    expect(img.style.maxWidth).toBe("");
    expect(img.style.maxHeight).toBe("");
  });

  it("opens overlay when clicking image in display mode", () => {
    render(<ImageComponent {...defaultProps} />);
    fireEvent.click(screen.getByTestId("editor-image"));
    expect(screen.getByTestId("image-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("image-overlay-img")).toHaveAttribute("src", defaultProps.src);
  });

  it("closes overlay when clicking backdrop", () => {
    render(<ImageComponent {...defaultProps} />);
    fireEvent.click(screen.getByTestId("editor-image"));
    expect(screen.getByTestId("image-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("image-overlay"));
    expect(screen.queryByTestId("image-overlay")).not.toBeInTheDocument();
  });

  it("closes overlay on Escape key", () => {
    render(<ImageComponent {...defaultProps} />);
    fireEvent.click(screen.getByTestId("editor-image"));
    expect(screen.getByTestId("image-overlay")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("image-overlay")).not.toBeInTheDocument();
  });

  it("does not open overlay when clicking image in edit mode", () => {
    mockEditor.isEditable.mockReturnValue(true);
    render(<ImageComponent {...defaultProps} />);
    fireEvent.click(screen.getByTestId("editor-image"));
    expect(screen.queryByTestId("image-overlay")).not.toBeInTheDocument();
  });

  it("applies max constraints even for inherit dimensions", () => {
    render(
      <ImageComponent
        {...defaultProps}
        width="inherit"
        height="inherit"
      />
    );
    const img = screen.getByTestId("editor-image");
    expect(img.style.maxWidth).toBe("1000px");
    expect(img.style.maxHeight).toBe("1000px");
  });
});
