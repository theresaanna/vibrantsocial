import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  isEditable: vi.fn().mockReturnValue(true),
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

describe("Image long-press context menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockEditor.isEditable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens context menu after 500ms long-press", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    const img = screen.getByAltText("test image");

    act(() => {
      fireEvent.touchStart(img, {
        touches: [{ clientX: 200, clientY: 150 }],
      });
    });

    expect(screen.queryByTestId("image-context-menu")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId("image-context-menu")).toBeInTheDocument();
  });

  it("does not open context menu on short tap", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    const img = screen.getByAltText("test image");

    act(() => {
      fireEvent.touchStart(img, {
        touches: [{ clientX: 200, clientY: 150 }],
      });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      fireEvent.touchEnd(img);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("image-context-menu")).not.toBeInTheDocument();
  });

  it("cancels long-press when finger moves", () => {
    render(
      <ImageComponent
        src="https://example.com/img.png"
        altText="test image"
        width={400}
        height={300}
        nodeKey="test-key"
      />
    );

    const img = screen.getByAltText("test image");

    act(() => {
      fireEvent.touchStart(img, {
        touches: [{ clientX: 200, clientY: 150 }],
      });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      fireEvent.touchMove(img);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("image-context-menu")).not.toBeInTheDocument();
  });

  it("does not open context menu when editor is not editable", () => {
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

    const img = screen.getByAltText("test image");

    act(() => {
      fireEvent.touchStart(img, {
        touches: [{ clientX: 200, clientY: 150 }],
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId("image-context-menu")).not.toBeInTheDocument();
  });
});
