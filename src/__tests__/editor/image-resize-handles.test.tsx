import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSetWidthAndHeight = vi.fn();

// Mock Lexical hooks
const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
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
  $getNodeByKey: vi.fn(() => ({
    setWidthAndHeight: mockSetWidthAndHeight,
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

  it("persists the final dragged width to the Lexical node on mouseup", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    // Start drag at x=500
    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

    // Drag to x=700 (delta = +200, so new width = 400 + 200 = 600)
    act(() => {
      fireEvent.mouseMove(document, { clientX: 700 });
    });

    // Release mouse
    act(() => {
      fireEvent.mouseUp(document);
    });

    // The Lexical node should be updated with the final dragged width (600), not the initial (400)
    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(600, "inherit");
  });

  it("persists the correct width after multiple mousemove events", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

    // Move through several positions
    act(() => {
      fireEvent.mouseMove(document, { clientX: 600 });
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 700 });
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 650 });
    });

    act(() => {
      fireEvent.mouseUp(document);
    });

    // Final position: delta = 650 - 500 = 150, width = 400 + 150 = 550
    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(550, "inherit");
  });

  it("clamps dragged width to a minimum of 100", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

    // Drag far left: delta = -500, so width would be 400 - 500 = -100, clamped to 100
    act(() => {
      fireEvent.mouseMove(document, { clientX: 0 });
    });

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(100, "inherit");
  });

  it("renders the action toolbar when selected and editable", () => {
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

  it("does not render action toolbar when not editable", () => {
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
});

describe("ImageComponent touch resize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("persists the final dragged width on touchend", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientX: 500 }] });
    });

    act(() => {
      fireEvent.touchMove(document, { touches: [{ clientX: 700 }] });
    });

    act(() => {
      fireEvent.touchEnd(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(600, "inherit");
  });

  it("clamps touch-dragged width to a minimum of 100", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientX: 500 }] });
    });

    act(() => {
      fireEvent.touchMove(document, { touches: [{ clientX: 0 }] });
    });

    act(() => {
      fireEvent.touchEnd(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(100, "inherit");
  });

  it("persists the correct width after multiple touchmove events", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.touchStart(handle, { touches: [{ clientX: 500 }] });
    });

    act(() => {
      fireEvent.touchMove(document, { touches: [{ clientX: 600 }] });
    });
    act(() => {
      fireEvent.touchMove(document, { touches: [{ clientX: 700 }] });
    });
    act(() => {
      fireEvent.touchMove(document, { touches: [{ clientX: 650 }] });
    });

    act(() => {
      fireEvent.touchEnd(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(550, "inherit");
  });

  it("resize handles have touch-action: none style", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");
    expect(handle.style.touchAction).toBe("none");
  });
});
