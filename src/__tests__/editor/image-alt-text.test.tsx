import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

async function openAltTextModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("sidebar-alt-text-button"));
}

describe("Image alt text editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("opens alt text modal with current alt text value", async () => {
    const user = userEvent.setup();
    renderImageComponent("A sunset over mountains");
    await user.click(screen.getByTestId("sidebar-alt-text-button"));

    const input = screen.getByTestId("alt-text-input") as HTMLTextAreaElement;
    expect(input.value).toBe("A sunset over mountains");
  });

  it("updates the Lexical node alt text on apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextModal(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);
    await user.type(input, "A beautiful landscape");

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(mockSetAltText).toHaveBeenCalledWith("A beautiful landscape");
  });

  it("allows empty alt text for decorative images", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextModal(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(mockSetAltText).toHaveBeenCalledWith("");
    expect(screen.queryByTestId("alt-text-input")).not.toBeInTheDocument();
  });

  it("closes modal after apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextModal(user);

    expect(screen.getByTestId("alt-text-input")).toBeInTheDocument();

    await user.click(screen.getByTestId("alt-text-apply-button"));

    expect(screen.queryByTestId("alt-text-input")).not.toBeInTheDocument();
  });

  it("updates the img element alt attribute after apply", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openAltTextModal(user);

    const input = screen.getByTestId("alt-text-input");
    await user.clear(input);
    await user.type(input, "New description");

    await user.click(screen.getByTestId("alt-text-apply-button"));

    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).toBe("New description");
  });
});
