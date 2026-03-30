import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSetWidthAndHeight = vi.fn();

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

vi.mock("@/components/editor/nodes/VideoNode", () => ({
  $isVideoNode: vi.fn().mockReturnValue(true),
}));

import VideoComponent from "@/components/editor/nodes/VideoComponent";

describe("VideoComponent resize handles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders all 4 resize handles when selected and editable", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const se = screen.getByTestId("resize-handle-se");
    const sw = screen.getByTestId("resize-handle-sw");
    const ne = screen.getByTestId("resize-handle-ne");
    const nw = screen.getByTestId("resize-handle-nw");

    expect(se.className).toContain("-right-2");
    expect(se.className).toContain("-bottom-2");

    expect(sw.className).toContain("-left-2");
    expect(sw.className).toContain("-bottom-2");

    expect(ne.className).toContain("-right-2");
    expect(ne.className).toContain("-top-2");

    expect(nw.className).toContain("-left-2");
    expect(nw.className).toContain("-top-2");
  });

  it("persists the final dragged width to the Lexical node on mouseup", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 700 });
    });

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(600, "inherit");
  });

  it("persists the correct width after multiple mousemove events", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

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

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(550, "inherit");
  });

  it("clamps dragged width to a minimum of 100", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");

    act(() => {
      fireEvent.mouseDown(handle, { clientX: 500 });
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 0 });
    });

    act(() => {
      fireEvent.mouseUp(document);
    });

    expect(mockSetWidthAndHeight).toHaveBeenCalledWith(100, "inherit");
  });

  it("renders the sidebar when selected and editable", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.getByTestId("video-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-resize-button")).toBeInTheDocument();
  });

  it("does not render sidebar when not editable", () => {
    mockEditor.isEditable.mockReturnValue(false);

    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    expect(screen.queryByTestId("video-sidebar")).not.toBeInTheDocument();
  });
});

describe("VideoComponent touch resize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("persists the final dragged width on touchend", () => {
    render(
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
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
      <VideoComponent
        src="https://example.com/video.mp4"
        fileName="video.mp4"
        mimeType="video/mp4"
        width={400}
        height="inherit"
        nodeKey="test-key"
      />
    );

    const handle = screen.getByTestId("resize-handle-se");
    expect(handle.style.touchAction).toBe("none");
  });
});
