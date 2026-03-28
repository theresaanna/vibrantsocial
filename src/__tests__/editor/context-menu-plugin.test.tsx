import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/* Mock Lexical core                                                   */
/* ------------------------------------------------------------------ */

let selectionCollapsed = false;
let selectionFormats = new Set<string>();
let anchorNodeParent: unknown = null;
let anchorNode: unknown = {};

const mockSelection = {
  isCollapsed: () => selectionCollapsed,
  hasFormat: (f: string) => selectionFormats.has(f),
  anchor: { getNode: () => anchorNode },
};

vi.mock("lexical", () => ({
  $getSelection: vi.fn(() => mockSelection),
  $isRangeSelection: vi.fn(() => true),
  FORMAT_TEXT_COMMAND: "FORMAT_TEXT_COMMAND",
  SELECTION_CHANGE_COMMAND: "SELECTION_CHANGE_COMMAND",
  COMMAND_PRIORITY_CRITICAL: 4,
}));

/* ------------------------------------------------------------------ */
/* Mock Lexical link                                                    */
/* ------------------------------------------------------------------ */

let isLinkNode = false;

vi.mock("@lexical/link", () => ({
  TOGGLE_LINK_COMMAND: "TOGGLE_LINK_COMMAND",
  $isLinkNode: vi.fn(() => isLinkNode),
}));

vi.mock("@lexical/utils", () => ({
  $findMatchingParent: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/* Mock Lexical selection                                               */
/* ------------------------------------------------------------------ */

const mockPatchStyleText = vi.fn();

vi.mock("@lexical/selection", () => ({
  $patchStyleText: (...args: unknown[]) => mockPatchStyleText(...args),
  $getSelectionStyleValueForProperty: vi.fn(() => ""),
}));

/* ------------------------------------------------------------------ */
/* Mock editor + composer context                                       */
/* ------------------------------------------------------------------ */

const mockRootElement = document.createElement("div");

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn((fn: () => void) => fn()),
  dispatchCommand: vi.fn(),
  isEditable: vi.fn().mockReturnValue(true),
  getRootElement: vi.fn(() => mockRootElement),
  getEditorState: vi.fn(() => ({
    read: (fn: () => void) => fn(),
  })),
};

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

/* ------------------------------------------------------------------ */
/* Mock createPortal to render inline (avoids jsdom cleanup errors)      */
/* ------------------------------------------------------------------ */

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

/* ------------------------------------------------------------------ */
/* Import component under test (AFTER mocks)                            */
/* ------------------------------------------------------------------ */

import { ContextMenuPlugin } from "@/components/editor/plugins/ContextMenuPlugin";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

let container: HTMLElement;

function renderPlugin() {
  const result = render(<ContextMenuPlugin />);
  container = result.container;
  return result;
}

function openMenu() {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    clientX: 200,
    clientY: 300,
  });
  Object.defineProperty(event, "preventDefault", {
    value: vi.fn(),
    writable: true,
  });
  act(() => {
    mockRootElement.dispatchEvent(event);
  });
}

function getMenu() {
  return container?.querySelector(".fixed");
}

function getMenuButton(label: string) {
  const menu = getMenu();
  if (!menu) return null;
  const buttons = menu.querySelectorAll("button");
  for (const btn of buttons) {
    if (btn.textContent?.includes(label)) return btn;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

describe("ContextMenuPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectionCollapsed = false;
    selectionFormats = new Set();
    isLinkNode = false;
    anchorNodeParent = null;
    anchorNode = { getParent: () => anchorNodeParent };
    mockPatchStyleText.mockReset();
  });

  it("does not show the menu initially", () => {
    renderPlugin();
    expect(getMenu()).toBeNull();
  });

  it("shows the context menu on right-click when text is selected", () => {
    renderPlugin();
    openMenu();
    expect(getMenu()).toBeTruthy();
  });

  it("does not show the menu when selection is collapsed", () => {
    selectionCollapsed = true;
    renderPlugin();
    openMenu();
    expect(getMenu()).toBeNull();
  });

  it("renders all format buttons", () => {
    renderPlugin();
    openMenu();
    expect(getMenuButton("Bold")).toBeTruthy();
    expect(getMenuButton("Italic")).toBeTruthy();
    expect(getMenuButton("Underline")).toBeTruthy();
    expect(getMenuButton("Strikethrough")).toBeTruthy();
  });

  it("renders link button", () => {
    renderPlugin();
    openMenu();
    expect(getMenuButton("Add Link")).toBeTruthy();
  });

  it("renders color buttons", () => {
    renderPlugin();
    openMenu();
    expect(getMenuButton("Text Color")).toBeTruthy();
    expect(getMenuButton("Background Color")).toBeTruthy();
  });

  it("dispatches FORMAT_TEXT_COMMAND for bold", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Bold")!);
    });
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "FORMAT_TEXT_COMMAND",
      "bold"
    );
  });

  it("dispatches FORMAT_TEXT_COMMAND for italic", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Italic")!);
    });
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "FORMAT_TEXT_COMMAND",
      "italic"
    );
  });

  it("dispatches FORMAT_TEXT_COMMAND for underline", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Underline")!);
    });
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "FORMAT_TEXT_COMMAND",
      "underline"
    );
  });

  it("dispatches FORMAT_TEXT_COMMAND for strikethrough", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Strikethrough")!);
    });
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "FORMAT_TEXT_COMMAND",
      "strikethrough"
    );
  });

  it("shows active format state with checkmark", () => {
    selectionFormats = new Set(["bold", "italic"]);
    renderPlugin();
    openMenu();

    const boldBtn = getMenuButton("Bold")!;
    expect(boldBtn.className).toContain("text-blue-600");

    const svg = boldBtn.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("prompts for URL and dispatches TOGGLE_LINK_COMMAND for Add Link", () => {
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValue("https://example.com");

    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Add Link")!);
    });

    expect(promptSpy).toHaveBeenCalledWith("Enter URL:");
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "TOGGLE_LINK_COMMAND",
      "https://example.com"
    );
    promptSpy.mockRestore();
  });

  it("shows Remove Link when selection is inside a link", () => {
    isLinkNode = true;
    renderPlugin();
    openMenu();
    expect(getMenuButton("Remove Link")).toBeTruthy();
  });

  it("dispatches TOGGLE_LINK_COMMAND with null when removing link", () => {
    isLinkNode = true;
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Remove Link")!);
    });
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(
      "TOGGLE_LINK_COMMAND",
      null
    );
  });

  it("opens text color submenu on click", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Text Color")!);
    });
    const submenu = container.querySelector(".absolute");
    expect(submenu).toBeTruthy();
    expect(submenu?.textContent).toContain("Text Color");
  });

  it("opens background color submenu on click", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Background Color")!);
    });
    const submenu = container.querySelector(".absolute");
    expect(submenu).toBeTruthy();
    expect(submenu?.textContent).toContain("Background Color");
  });

  it("applies text color via $patchStyleText", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Text Color")!);
    });

    const swatches = container.querySelectorAll(".absolute .grid button");
    expect(swatches.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(swatches[0]);
    });

    expect(mockPatchStyleText).toHaveBeenCalledWith(mockSelection, {
      color: "#000000",
    });
  });

  it("applies background color via $patchStyleText", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Background Color")!);
    });

    const swatches = container.querySelectorAll(".absolute .grid button");
    expect(swatches.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(swatches[6]);
    });

    expect(mockPatchStyleText).toHaveBeenCalledWith(mockSelection, {
      "background-color": "#ff0000",
    });
  });

  it("closes the menu on Escape key", () => {
    renderPlugin();
    openMenu();
    expect(getMenu()).toBeTruthy();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(getMenu()).toBeNull();
  });

  it("closes the menu on click outside", () => {
    renderPlugin();
    openMenu();
    expect(getMenu()).toBeTruthy();

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(getMenu()).toBeNull();
  });

  it("does not close when clicking inside the menu", () => {
    renderPlugin();
    openMenu();
    const menu = getMenu()!;

    act(() => {
      fireEvent.mouseDown(menu);
    });
    expect(getMenu()).toBeTruthy();
  });

  it("renders the menu as a fixed-position overlay", () => {
    renderPlugin();
    openMenu();
    const menu = getMenu();
    expect(menu).toBeTruthy();
    expect(menu?.className).toContain("fixed");
    expect(menu?.className).toContain("z-[9999]");
  });

  it("closes the menu after applying a link", () => {
    vi.spyOn(window, "prompt").mockReturnValue("https://example.com");
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Add Link")!);
    });
    expect(getMenu()).toBeNull();
    vi.restoreAllMocks();
  });

  it("does not add link if prompt is cancelled", () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Add Link")!);
    });
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalledWith(
      "TOGGLE_LINK_COMMAND",
      expect.anything()
    );
    vi.restoreAllMocks();
  });

  it("clears color via the Clear button in color submenu", () => {
    renderPlugin();
    openMenu();
    act(() => {
      fireEvent.click(getMenuButton("Text Color")!);
    });

    const clearBtn = Array.from(
      container.querySelectorAll(".absolute button")
    ).find((b) => b.textContent === "Clear");
    expect(clearBtn).toBeTruthy();

    act(() => {
      fireEvent.click(clearBtn!);
    });

    expect(mockPatchStyleText).toHaveBeenCalledWith(mockSelection, {
      color: null,
    });
  });
});
