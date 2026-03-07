import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ReadOnlyChecklistPlugin } from "@/components/editor/plugins/ReadOnlyChecklistPlugin";

const mockRegisterCommand = vi.fn(() => vi.fn());
const mockRootElement = document.createElement("div");
mockRootElement.addEventListener = vi.fn();
mockRootElement.removeEventListener = vi.fn();
const mockGetRootElement = vi.fn(() => mockRootElement);

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [
    {
      registerCommand: mockRegisterCommand,
      getRootElement: mockGetRootElement,
    },
  ],
}));

// Import the command constants to verify they're used
vi.mock("lexical", async () => {
  return {
    KEY_DOWN_COMMAND: "KEY_DOWN_COMMAND",
    PASTE_COMMAND: "PASTE_COMMAND",
    DROP_COMMAND: "DROP_COMMAND",
    DRAGSTART_COMMAND: "DRAGSTART_COMMAND",
    CUT_COMMAND: "CUT_COMMAND",
    COMMAND_PRIORITY_CRITICAL: 4,
  };
});

describe("ReadOnlyChecklistPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders null (no DOM output)", () => {
    const { container } = render(<ReadOnlyChecklistPlugin />);
    expect(container.innerHTML).toBe("");
  });

  it("registers 5 command handlers to block editing", () => {
    render(<ReadOnlyChecklistPlugin />);
    expect(mockRegisterCommand).toHaveBeenCalledTimes(5);
  });

  it("blocks KEY_DOWN_COMMAND at critical priority", () => {
    render(<ReadOnlyChecklistPlugin />);
    const calls = mockRegisterCommand.mock.calls;
    const keyDownCall = calls.find((c) => c[0] === "KEY_DOWN_COMMAND");
    expect(keyDownCall).toBeTruthy();
    expect(keyDownCall![2]).toBe(4); // COMMAND_PRIORITY_CRITICAL
    expect(keyDownCall![1]()).toBe(true); // handler returns true to block
  });

  it("blocks PASTE_COMMAND at critical priority", () => {
    render(<ReadOnlyChecklistPlugin />);
    const calls = mockRegisterCommand.mock.calls;
    const pasteCall = calls.find((c) => c[0] === "PASTE_COMMAND");
    expect(pasteCall).toBeTruthy();
    expect(pasteCall![2]).toBe(4);
    expect(pasteCall![1]()).toBe(true);
  });

  it("blocks CUT_COMMAND at critical priority", () => {
    render(<ReadOnlyChecklistPlugin />);
    const calls = mockRegisterCommand.mock.calls;
    const cutCall = calls.find((c) => c[0] === "CUT_COMMAND");
    expect(cutCall).toBeTruthy();
    expect(cutCall![2]).toBe(4);
    expect(cutCall![1]()).toBe(true);
  });

  it("blocks DROP_COMMAND at critical priority", () => {
    render(<ReadOnlyChecklistPlugin />);
    const calls = mockRegisterCommand.mock.calls;
    const dropCall = calls.find((c) => c[0] === "DROP_COMMAND");
    expect(dropCall).toBeTruthy();
    expect(dropCall![2]).toBe(4);
    expect(dropCall![1]()).toBe(true);
  });

  it("blocks DRAGSTART_COMMAND at critical priority", () => {
    render(<ReadOnlyChecklistPlugin />);
    const calls = mockRegisterCommand.mock.calls;
    const dragCall = calls.find((c) => c[0] === "DRAGSTART_COMMAND");
    expect(dragCall).toBeTruthy();
    expect(dragCall![2]).toBe(4);
    expect(dragCall![1]()).toBe(true);
  });

  it("attaches a beforeinput listener to the root element", () => {
    render(<ReadOnlyChecklistPlugin />);
    expect(mockRootElement.addEventListener).toHaveBeenCalledWith(
      "beforeinput",
      expect.any(Function)
    );
  });

  it("cleans up command registrations on unmount", () => {
    const unregister1 = vi.fn();
    const unregister2 = vi.fn();
    const unregister3 = vi.fn();
    const unregister4 = vi.fn();
    const unregister5 = vi.fn();
    mockRegisterCommand
      .mockReturnValueOnce(unregister1)
      .mockReturnValueOnce(unregister2)
      .mockReturnValueOnce(unregister3)
      .mockReturnValueOnce(unregister4)
      .mockReturnValueOnce(unregister5);

    const { unmount } = render(<ReadOnlyChecklistPlugin />);
    unmount();

    expect(unregister1).toHaveBeenCalled();
    expect(unregister2).toHaveBeenCalled();
    expect(unregister3).toHaveBeenCalled();
    expect(unregister4).toHaveBeenCalled();
    expect(unregister5).toHaveBeenCalled();
  });
});
