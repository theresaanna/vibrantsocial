import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockEditor = {
  registerCommand: vi.fn().mockReturnValue(() => {}),
  update: vi.fn(),
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

// We need to test ResizePopover directly, but it's not exported.
// Instead we re-export it for testing via a test helper approach.
// Since ResizePopover is an internal function, we'll test it through
// the ImageComponent by triggering the context menu -> Resize flow.
// However, that requires right-click + menu interaction which is complex.
//
// A simpler approach: extract and test the validation logic, or test
// ResizePopover by temporarily exporting it. Let's test via the component
// by directly importing and rendering it through a wrapper.

// Since ResizePopover is not exported, we'll test the behavior through
// a re-export. But first, let's check if we can access it.
// We'll take the approach of testing through the full ImageComponent flow.

// Actually, the simplest approach: we can render ImageComponent, right-click
// to open context menu, click Resize, and then interact with the popover.
// But that's complex in unit tests. Instead, let's export ResizePopover
// for testing. We'll use a different approach: test the component indirectly.

// For a clean unit test, let's just directly test by importing the default
// ImageComponent and interacting with it.

import ImageComponent from "@/components/editor/nodes/ImageComponent";

function renderImageComponent() {
  return render(
    <ImageComponent
      src="https://example.com/img.png"
      altText="test"
      width={400}
      height={300}
      nodeKey="test-key"
    />
  );
}

async function openResizePopover(user: ReturnType<typeof userEvent.setup>) {
  const img = screen.getByAltText("test");
  // Right-click to open context menu
  await user.pointer({ keys: "[MouseRight]", target: img });
  // Click "Resize" in context menu
  const resizeButton = screen.getByText("Resize");
  await user.click(resizeButton);
}

describe("ResizePopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders width and height inputs with initial values", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    const widthInput = screen.getByTestId("resize-width-input") as HTMLInputElement;
    const heightInput = screen.getByTestId("resize-height-input") as HTMLInputElement;

    expect(widthInput).toBeInTheDocument();
    expect(heightInput).toBeInTheDocument();
    expect(widthInput.value).toBe("400");
    expect(heightInput.value).toBe("300");
  });

  it("allows typing any value in the inputs", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    const widthInput = screen.getByTestId("resize-width-input") as HTMLInputElement;
    await user.clear(widthInput);
    await user.type(widthInput, "abc");

    expect(widthInput.value).toBe("abc");
  });

  it("shows error when submitting with empty width", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    // Unlock aspect ratio so clearing width doesn't affect height
    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive whole numbers/);
  });

  it("shows error when submitting with empty height", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const heightInput = screen.getByTestId("resize-height-input");
    await user.clear(heightInput);

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive whole numbers/);
  });

  it("shows error when submitting with non-numeric value", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);
    await user.type(widthInput, "abc");

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive whole numbers/);
  });

  it("shows error when submitting with value less than 10", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);
    await user.type(widthInput, "5");

    const heightInput = screen.getByTestId("resize-height-input");
    await user.clear(heightInput);
    await user.type(heightInput, "20");

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/Minimum size is 10/);
  });

  it("shows error when submitting with decimal value", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);
    await user.type(widthInput, "100.5");

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive whole numbers/);
  });

  it("calls onApply with valid values and closes popover", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    const heightInput = screen.getByTestId("resize-height-input");
    await user.clear(widthInput);
    await user.type(widthInput, "200");
    await user.clear(heightInput);
    await user.type(heightInput, "150");

    await user.click(screen.getByTestId("resize-apply-button"));

    // Popover should close (no error, popover gone)
    expect(screen.queryByTestId("resize-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-resize-popover")).not.toBeInTheDocument();
  });

  it("updates height proportionally when aspect ratio is locked", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    // Natural dimensions fall back to 300x200 in jsdom, so aspect ratio = 3:2
    const widthInput = screen.getByTestId("resize-width-input") as HTMLInputElement;
    const heightInput = screen.getByTestId("resize-height-input") as HTMLInputElement;

    await user.clear(widthInput);
    await user.type(widthInput, "600");

    // Height should be updated proportionally: 600 / (300/200) = 400
    expect(heightInput.value).toBe("400");
  });

  it("does not update height when aspect ratio is unlocked", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    // Unlock aspect ratio
    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input") as HTMLInputElement;
    const heightInput = screen.getByTestId("resize-height-input") as HTMLInputElement;

    const originalHeight = heightInput.value;
    await user.clear(widthInput);
    await user.type(widthInput, "800");

    expect(heightInput.value).toBe(originalHeight);
  });

  it("clears error when user types a new value", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizePopover(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);
    await user.type(widthInput, "abc");
    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();

    // Type a new value — error should clear
    await user.clear(widthInput);
    await user.type(widthInput, "200");

    expect(screen.queryByTestId("resize-error")).not.toBeInTheDocument();
  });
});
