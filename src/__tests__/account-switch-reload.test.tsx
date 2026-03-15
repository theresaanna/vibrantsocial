/**
 * Regression tests for account switching full-reload behavior.
 *
 * These tests verify that account switching always performs a hard browser
 * reload (window.location.reload / window.location.replace) instead of a
 * Next.js soft navigation (router.refresh / router.replace). The soft
 * navigation left stale data in server components, layouts, and client caches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockRouterRefresh = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    refresh: mockRouterRefresh,
  })),
  usePathname: vi.fn(() => "/profile"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: "user1",
        username: "user_one",
        displayName: "User One",
        avatar: null,
        bio: null,
        tier: "free",
        isEmailVerified: true,
        authProvider: "credentials",
        linkedAccounts: [
          { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
        ],
      },
      expires: "2026-12-31",
    },
    status: "authenticated",
    update: mockUpdate,
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/profile/account-linking-actions", () => ({
  switchAccount: vi.fn().mockResolvedValue({ success: true, message: "Switched" }),
}));

import { AccountSwitcher } from "@/components/account-switcher";

const originalLocation = window.location;

describe("Account switch full-reload regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        reload: vi.fn(),
        replace: vi.fn(),
        href: "http://localhost/profile",
        pathname: "/profile",
        search: "",
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("REGRESSION: uses window.location.reload instead of router.refresh", async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled();
    });

    // router.refresh must NOT be called — it was causing stale UI
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it("REGRESSION: does not use router.replace for navigation after switch", async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled();
    });

    // router.replace must NOT be called
    expect(mockRouterReplace).not.toHaveBeenCalled();
    // router.push must NOT be called
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("REGRESSION: updates JWT before reloading", async () => {
    const callOrder: string[] = [];
    mockUpdate.mockImplementation(async () => {
      callOrder.push("update");
    });
    (window.location.reload as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("reload");
    });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(callOrder).toEqual(["update", "reload"]);
    });
  });

  it("REGRESSION: passes correct switchToUserId to session update", async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ switchToUserId: "user2" });
    });
  });
});
