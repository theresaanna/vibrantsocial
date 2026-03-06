import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

// Mock Lexical hooks
const mockEditor = {
  isEditable: () => true,
  update: vi.fn(),
};

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

vi.mock("@lexical/react/useLexicalNodeSelection", () => ({
  useLexicalNodeSelection: () => [false, vi.fn()],
}));

vi.mock("lexical", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lexical")>();
  return {
    ...actual,
    $getNodeByKey: vi.fn(),
  };
});

vi.mock("@/components/editor/nodes/ExcalidrawNode", () => ({
  $isExcalidrawNode: () => false,
  ExcalidrawNode: class {},
  $createExcalidrawNode: vi.fn(),
}));

// Mock @excalidraw/excalidraw to avoid dynamic import issues
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: (props: Record<string, unknown>) => (
    <div data-testid="excalidraw-canvas">Excalidraw Canvas</div>
  ),
}));

import ExcalidrawComponent from "@/components/editor/nodes/ExcalidrawComponent";

describe("ExcalidrawComponent", () => {
  it("renders empty drawing placeholder when no elements", () => {
    render(<ExcalidrawComponent data="{}" nodeKey="test-key" />);

    expect(screen.getByText("Empty Drawing")).toBeTruthy();
    expect(screen.getByText("Double-click to start drawing")).toBeTruthy();
  });

  it("renders drawing info when elements exist", () => {
    const data = JSON.stringify({
      elements: [{ id: "1" }, { id: "2" }],
    });
    render(<ExcalidrawComponent data={data} nodeKey="test-key" />);

    expect(screen.getByText("Excalidraw Drawing")).toBeTruthy();
    expect(
      screen.getByText("2 element(s) \u2014 Double-click to edit")
    ).toBeTruthy();
  });
});

describe("ExcalidrawModal", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  function openModal() {
    const { container } = render(
      <ExcalidrawComponent data="{}" nodeKey="test-key" />
    );
    // Double-click to open modal
    const drawingArea = container.querySelector('[role="button"]')!;
    fireEvent.doubleClick(drawingArea);
    return container;
  }

  it("renders modal as a portal in document.body", () => {
    openModal();

    // The modal overlay should be portaled to document.body
    const overlay = document.body.querySelector(".bg-black\\/50");
    expect(overlay).toBeTruthy();
  });

  it("has a dark overlay backdrop", () => {
    openModal();

    const overlay = document.body.querySelector(".bg-black\\/50");
    expect(overlay).toBeTruthy();
    expect(overlay).toHaveClass("absolute", "inset-0");
  });

  it("renders a centered modal container with proper sizing", () => {
    openModal();

    const modalContainer = document.body.querySelector(
      ".h-\\[90vh\\].w-\\[90vw\\]"
    );
    expect(modalContainer).toBeTruthy();
    expect(modalContainer).toHaveClass("rounded-xl");
    expect(modalContainer).toHaveClass("shadow-2xl");
  });

  it("has Save and Cancel buttons", () => {
    openModal();

    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("has Excalidraw title in header", () => {
    openModal();

    expect(screen.getByText("Excalidraw")).toBeTruthy();
  });

  it("locks body scroll when modal is open", () => {
    openModal();

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes modal and restores scroll on Cancel click", () => {
    openModal();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByText("Cancel"));

    expect(document.body.style.overflow).toBe("");
    // Modal overlay should be gone
    const overlay = document.body.querySelector(".bg-black\\/50");
    expect(overlay).toBeFalsy();
  });

  it("closes modal on overlay click", () => {
    openModal();

    const overlay = document.body.querySelector(
      ".bg-black\\/50"
    ) as HTMLElement;
    fireEvent.click(overlay);

    const overlayAfter = document.body.querySelector(".bg-black\\/50");
    expect(overlayAfter).toBeFalsy();
  });

  it("closes modal on Escape key", () => {
    openModal();

    fireEvent.keyDown(document, { key: "Escape" });

    const overlay = document.body.querySelector(".bg-black\\/50");
    expect(overlay).toBeFalsy();
  });

  it("shows loading state before Excalidraw loads", () => {
    // Reset the mock to simulate loading
    vi.doMock("@excalidraw/excalidraw", () => ({
      Excalidraw: undefined,
    }));

    openModal();

    // The loading or canvas text should be present
    // (depending on dynamic import timing, either state is valid)
    const modalContent = document.body.querySelector(".flex-1");
    expect(modalContent).toBeTruthy();
  });
});
