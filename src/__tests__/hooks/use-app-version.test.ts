import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Store the original env value to restore later
const ORIGINAL_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

beforeEach(() => {
  process.env.NEXT_PUBLIC_BUILD_ID = "build-abc123";
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  process.env.NEXT_PUBLIC_BUILD_ID = ORIGINAL_BUILD_ID;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Re-import the hook fresh for each test to pick up the env var
async function importHook() {
  // Clear the module cache so the module-level `initialBuildId` is re-evaluated
  vi.resetModules();
  const mod = await import("@/hooks/use-app-version");
  return mod.useAppVersion;
}

describe("useAppVersion", () => {
  it("starts with hasUpdate false", async () => {
    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());
    expect(result.current.hasUpdate).toBe(false);
  });

  it("sets hasUpdate to true when server returns a different build ID", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ buildId: "build-xyz789" }), { status: 200 })
    );

    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());

    // Advance past the poll interval (60s)
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.hasUpdate).toBe(true);
  });

  it("keeps hasUpdate false when server returns the same build ID", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ buildId: "build-abc123" }), { status: 200 })
    );

    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.hasUpdate).toBe(false);
  });

  it("keeps hasUpdate false on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.hasUpdate).toBe(false);
  });

  it("keeps hasUpdate false on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Server error", { status: 500 })
    );

    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.hasUpdate).toBe(false);
  });

  it("checks version on visibility change to visible", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ buildId: "build-new" }), { status: 200 })
    );

    const useAppVersion = await importHook();
    const { result } = renderHook(() => useAppVersion());

    // Simulate tab becoming visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetch).toHaveBeenCalledWith("/api/version");
    expect(result.current.hasUpdate).toBe(true);
  });

  it("does not check version when tab becomes hidden", async () => {
    const useAppVersion = await importHook();
    renderHook(() => useAppVersion());

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("cleans up interval and listener on unmount", async () => {
    const removeEventListenerSpy = vi.spyOn(
      document,
      "removeEventListener"
    );

    const useAppVersion = await importHook();
    const { unmount } = renderHook(() => useAppVersion());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });
});
