import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePostViewTracking } from "@/hooks/use-post-view-tracking";

const mockRecordPostView = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/feed/view-actions", () => ({
  recordPostView: (...args: unknown[]) => mockRecordPostView(...args),
}));

describe("usePostViewTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "referrer", {
      value: "https://example.com",
      configurable: true,
    });
  });

  it("calls recordPostView on mount with correct args", () => {
    renderHook(() => usePostViewTracking("post1", "direct"));

    expect(mockRecordPostView).toHaveBeenCalledOnce();
    expect(mockRecordPostView).toHaveBeenCalledWith({
      postId: "post1",
      source: "direct",
      referrer: "https://example.com",
    });
  });

  it("does not call recordPostView when disabled", () => {
    renderHook(() => usePostViewTracking("post1", "direct", false));

    expect(mockRecordPostView).not.toHaveBeenCalled();
  });

  it("does not double-fire on re-render with same postId", () => {
    const { rerender } = renderHook(
      ({ postId }) => usePostViewTracking(postId, "feed"),
      { initialProps: { postId: "post1" } },
    );

    rerender({ postId: "post1" });

    expect(mockRecordPostView).toHaveBeenCalledOnce();
  });

  it("fires again for a different postId", () => {
    const { rerender } = renderHook(
      ({ postId }) => usePostViewTracking(postId, "feed"),
      { initialProps: { postId: "post1" } },
    );

    rerender({ postId: "post2" });

    expect(mockRecordPostView).toHaveBeenCalledTimes(2);
  });
});
