import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetAltText = vi.fn();

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
    setAltText: mockSetAltText,
    setWidthAndHeight: vi.fn(),
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

function renderImageComponent(altText = "test image") {
  return render(
    <ImageComponent
      src="https://example.com/img.png"
      altText={altText}
      width={400}
      height={300}
      nodeKey="test-key"
    />
  );
}

async function openContextMenu(user: ReturnType<typeof userEvent.setup>) {
  const img = screen.getByAltText("test image");
  await user.pointer({ keys: "[MouseRight]", target: img });
}

async function openAltTextPopover(user: ReturnType<typeof userEvent.setup>) {
  await openContextMenu(user);
  await user.click(screen.getByTestId("context-menu-alt-text"));
}

describe("Image alt text editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("shows 'Alt text' option in the context menu", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openContextMenu(user);

    expect(screen.getByTestId("context-menu-alt-text")).toBeInTheDocument();
    expect(screen.getByText("Alt text")).toBeInTheDocument();
  });

  it("opens alt text popover with current alt text value", async () => {
    const user = userEvent.setup();
    renderImageComponent("A sunset over mountains");
    const img = screen.getByAltText("A sunset over mountains");
    await user.pointer({ keys: "[MouseRight]", target: img });
    await user.click(screen.getByTestId("context-menu-alt-text"));

    const input = screen.getByTestId("alt-text-input") as HTMLInputElement;
    expect(input.value).toBe("A sunset over mountains");
  });

  it("updates the Lexical node alt text on apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextPopover(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);
    await user.type(input, "A beautiful landscape");

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(mockSetAltText).toHaveBeenCalledWith("A beautiful landscape");
  });

  it("allows empty alt text for decorative images", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextPopover(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(mockSetAltText).toHaveBeenCalledWith("");
    expect(screen.queryByTestId("alt-text-popover")).not.toBeInTheDocument();
  });

  it("closes popover after apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextPopover(user);

    expect(screen.getByTestId("alt-text-popover")).toBeInTheDocument();

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(screen.queryByTestId("alt-text-popover")).not.toBeInTheDocument();
  });

  it("updates the img element alt attribute after apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextPopover(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);
    await user.type(input, "New description");

    await user.click(screen.getByTestId("alt-text-apply-button"));

    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).toBe("New description");
  });
});
