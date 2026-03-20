import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

vi.mock("@/components/editor/nodes/ImageNode", () => ({
  $isImageNode: vi.fn().mockReturnValue(true),
}));

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

async function openResizeModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("sidebar-resize-button"));
}

describe("Resize modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isEditable.mockReturnValue(true);
  });

  it("renders width and height inputs with initial values", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

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
    await openResizeModal(user);

    const widthInput = screen.getByTestId("resize-width-input") as HTMLInputElement;
    await user.clear(widthInput);
    await user.type(widthInput, "abc");

    expect(widthInput.value).toBe("abc");
  });

  it("shows error when submitting with empty width", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    // Unlock aspect ratio so clearing width doesn't affect height
    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive numbers/);
  });

  it("shows error when submitting with empty height", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const heightInput = screen.getByTestId("resize-height-input");
    await user.clear(heightInput);

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive numbers/);
  });

  it("shows error when submitting with non-numeric value", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    await user.clear(widthInput);
    await user.type(widthInput, "abc");

    await user.click(screen.getByTestId("resize-apply-button"));

    expect(screen.getByTestId("resize-error")).toBeInTheDocument();
    expect(screen.getByTestId("resize-error").textContent).toMatch(/positive numbers/);
  });

  it("shows error when submitting with value less than 10", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

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

  it("calls apply with valid values and closes modal", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    await user.click(screen.getByTestId("resize-aspect-lock"));

    const widthInput = screen.getByTestId("resize-width-input");
    const heightInput = screen.getByTestId("resize-height-input");
    await user.clear(widthInput);
    await user.type(widthInput, "200");
    await user.clear(heightInput);
    await user.type(heightInput, "150");

    await user.click(screen.getByTestId("resize-apply-button"));

    // Modal should close (no error, inputs gone)
    expect(screen.queryByTestId("resize-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resize-width-input")).not.toBeInTheDocument();
  });

  it("updates height proportionally when aspect ratio is locked", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

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
    await openResizeModal(user);

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
    await openResizeModal(user);

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

  it("shows unit toggle with px and % options", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    expect(screen.getByTestId("unit-toggle-px")).toBeInTheDocument();
    expect(screen.getByTestId("unit-toggle-pct")).toBeInTheDocument();
  });

  it("shows preset buttons", async () => {
    const user = userEvent.setup();
    renderImageComponent();
    await openResizeModal(user);

    expect(screen.getByTestId("preset-25")).toBeInTheDocument();
    expect(screen.getByTestId("preset-50")).toBeInTheDocument();
    expect(screen.getByTestId("preset-100")).toBeInTheDocument();
  });
});
