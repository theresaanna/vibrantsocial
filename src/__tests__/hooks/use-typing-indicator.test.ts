import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";

const mockPublish = vi.fn();
let channelCallback: (event: { name: string; data: { userId: string } }) => void;

vi.mock("ably/react", () => ({
  useChannel: vi.fn((_channelName: string, cb: (event: { name: string; data: { userId: string } }) => void) => {
    channelCallback = cb;
    return { channel: { publish: mockPublish } };
  }),
}));

describe("useTypingIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty typing set", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));
    expect(result.current.typingUsers.size).toBe(0);
  });

  it("adds user on 'start' event", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      channelCallback({ name: "start", data: { userId: "other" } });
    });

    expect(result.current.typingUsers.has("other")).toBe(true);
  });

  it("removes user on 'stop' event", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      channelCallback({ name: "start", data: { userId: "other" } });
    });
    expect(result.current.typingUsers.has("other")).toBe(true);

    act(() => {
      channelCallback({ name: "stop", data: { userId: "other" } });
    });
    expect(result.current.typingUsers.has("other")).toBe(false);
  });

  it("ignores events from current user", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      channelCallback({ name: "start", data: { userId: "me" } });
    });

    expect(result.current.typingUsers.size).toBe(0);
  });

  it("auto-removes user after 3s timeout", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      channelCallback({ name: "start", data: { userId: "other" } });
    });
    expect(result.current.typingUsers.has("other")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.typingUsers.has("other")).toBe(false);
  });

  it("keystroke() publishes 'start' event", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      result.current.keystroke();
    });

    expect(mockPublish).toHaveBeenCalledWith("start", { userId: "me" });
  });

  it("keystroke() auto-sends 'stop' after timeout", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      result.current.keystroke();
    });

    expect(mockPublish).toHaveBeenCalledWith("start", { userId: "me" });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockPublish).toHaveBeenCalledWith("stop", { userId: "me" });
  });

  it("stopTyping() publishes 'stop' event", () => {
    const { result } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      result.current.stopTyping();
    });

    expect(mockPublish).toHaveBeenCalledWith("stop", { userId: "me" });
  });

  it("cleans up timers on unmount", () => {
    const { result, unmount } = renderHook(() => useTypingIndicator("conv1", "me"));

    act(() => {
      channelCallback({ name: "start", data: { userId: "other" } });
      result.current.keystroke();
    });

    // Unmount should clear timers without warnings
    unmount();

    // Advancing timers after unmount should not throw
    act(() => {
      vi.advanceTimersByTime(5000);
    });
  });
});
