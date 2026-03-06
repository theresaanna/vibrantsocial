import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReadReceipts } from "@/hooks/use-read-receipts";

const mockPublish = vi.fn();
let channelCallback: (event: { name: string; data: { userId: string; timestamp: string } }) => void;
let mockChannel: { publish: typeof mockPublish } | null = { publish: mockPublish };

vi.mock("ably/react", () => ({
  useChannel: vi.fn((_channelName: string, cb: (event: { name: string; data: { userId: string; timestamp: string } }) => void) => {
    channelCallback = cb;
    return { channel: mockChannel };
  }),
}));

describe("useReadReceipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel = { publish: mockPublish };
  });

  it("starts with empty readTimestamps", () => {
    const { result } = renderHook(() => useReadReceipts("conv1"));
    expect(result.current.readTimestamps.size).toBe(0);
  });

  it("updates readTimestamps on 'read' event", () => {
    const { result } = renderHook(() => useReadReceipts("conv1"));

    act(() => {
      channelCallback({
        name: "read",
        data: { userId: "user2", timestamp: "2024-01-01T10:00:00Z" },
      });
    });

    expect(result.current.readTimestamps.has("user2")).toBe(true);
    expect(result.current.readTimestamps.get("user2")).toEqual(
      new Date("2024-01-01T10:00:00Z")
    );
  });

  it("handles multiple read events from different users", () => {
    const { result } = renderHook(() => useReadReceipts("conv1"));

    act(() => {
      channelCallback({
        name: "read",
        data: { userId: "user2", timestamp: "2024-01-01T10:00:00Z" },
      });
    });

    act(() => {
      channelCallback({
        name: "read",
        data: { userId: "user3", timestamp: "2024-01-01T11:00:00Z" },
      });
    });

    expect(result.current.readTimestamps.size).toBe(2);
    expect(result.current.readTimestamps.has("user2")).toBe(true);
    expect(result.current.readTimestamps.has("user3")).toBe(true);
  });

  it("updates timestamp for same user with latest value", () => {
    const { result } = renderHook(() => useReadReceipts("conv1"));

    act(() => {
      channelCallback({
        name: "read",
        data: { userId: "user2", timestamp: "2024-01-01T10:00:00Z" },
      });
    });

    act(() => {
      channelCallback({
        name: "read",
        data: { userId: "user2", timestamp: "2024-01-01T12:00:00Z" },
      });
    });

    expect(result.current.readTimestamps.get("user2")).toEqual(
      new Date("2024-01-01T12:00:00Z")
    );
  });

  it("publishRead publishes to channel", () => {
    const { result } = renderHook(() => useReadReceipts("conv1"));

    act(() => {
      result.current.publishRead("user1");
    });

    expect(mockPublish).toHaveBeenCalledWith("read", expect.objectContaining({
      userId: "user1",
      timestamp: expect.any(String),
    }));
  });

  it("publishRead is no-op when channel is null", () => {
    mockChannel = null;
    const { result } = renderHook(() => useReadReceipts("conv1"));

    act(() => {
      result.current.publishRead("user1");
    });

    expect(mockPublish).not.toHaveBeenCalled();
  });
});
