import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mockUpdate = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: "user1", username: "u1", linkedAccounts: [] },
      expires: "2026-12-31",
    },
    status: "authenticated",
    update: mockUpdate,
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => "/profile"),
}));

import { AutoAccountSwitch } from "@/components/auto-account-switch";

const originalLocation = window.location;

describe("AutoAccountSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    // Make window.location writable and spy-able
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost/profile?_switchTo=user2",
        pathname: "/profile",
        search: "?_switchTo=user2",
        replace: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    // Reset the URLSearchParams between tests
    mockSearchParams.delete("_switchTo");
  });

  it("does nothing when no _switchTo param", () => {
    // searchParams has no _switchTo
    render(<AutoAccountSwitch />);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it("calls update and does a full page reload when _switchTo is present", async () => {
    mockSearchParams.set("_switchTo", "user2");

    render(<AutoAccountSwitch />);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ switchToUserId: "user2" });
    });

    await waitFor(() => {
      // Must use window.location.replace (full reload), NOT router.replace
      expect(window.location.replace).toHaveBeenCalledWith("/profile");
    });
  });

  it("strips the _switchTo param from the URL on reload", async () => {
    mockSearchParams.set("_switchTo", "user2");
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        href: "http://localhost/profile?_switchTo=user2&tab=settings",
        pathname: "/profile",
        search: "?_switchTo=user2&tab=settings",
        replace: vi.fn(),
      },
    });

    render(<AutoAccountSwitch />);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith(
        "/profile?tab=settings"
      );
    });
  });

  it("only runs once even if re-rendered", async () => {
    mockSearchParams.set("_switchTo", "user2");

    const { rerender } = render(<AutoAccountSwitch />);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    // Re-render the component
    rerender(<AutoAccountSwitch />);

    // Should still only have been called once
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders nothing (no visible UI)", () => {
    mockSearchParams.set("_switchTo", "user2");

    const { container } = render(<AutoAccountSwitch />);
    expect(container.innerHTML).toBe("");
  });
});
