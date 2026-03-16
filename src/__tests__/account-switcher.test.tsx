import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn().mockReturnValue("/"),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/profile/account-linking-actions", () => ({
  switchAccount: vi.fn(),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

const mockGetLinkedAccountNotificationCounts = vi.fn().mockResolvedValue({});

vi.mock("@/app/notifications/actions", () => ({
  getLinkedAccountNotificationCounts: (...args: unknown[]) =>
    mockGetLinkedAccountNotificationCounts(...args),
}));

import { useSession } from "next-auth/react";
import { switchAccount } from "@/app/profile/account-linking-actions";
import { useAblyReady } from "@/app/providers";
import { getAblyRealtimeClient } from "@/lib/ably";
import { AccountSwitcher } from "@/components/account-switcher";

const mockUseSession = vi.mocked(useSession);
const mockSwitchAccount = vi.mocked(switchAccount);

const linkedAccounts = [
  { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
  { id: "user3", username: "user_three", displayName: "User Three", avatar: "https://example.com/avatar.jpg" },
];

// Save/restore the real location so we can spy on reload()
const originalLocation = window.location;

function setupSession(overrides: Record<string, unknown> = {}) {
  mockUseSession.mockReturnValue({
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
        linkedAccounts,
        ...overrides,
      },
      expires: "2026-12-31",
    },
    status: "authenticated",
    update: vi.fn(),
  });
}

describe("AccountSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Replace window.location with a spy-able object
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, reload: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("renders nothing when no linked accounts", () => {
    mockUseSession.mockReturnValue({
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
          linkedAccounts: [],
        },
        expires: "2026-12-31",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    const { container } = render(<AccountSwitcher />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when not authenticated", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    const { container } = render(<AccountSwitcher />);
    expect(container.innerHTML).toBe("");
  });

  it("renders switch button when linked accounts exist", () => {
    setupSession();

    render(<AccountSwitcher />);
    expect(screen.getByTestId("account-switcher-button")).toBeInTheDocument();
  });

  it("opens dropdown on click and shows linked accounts", () => {
    setupSession();

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    expect(screen.getByTestId("account-switcher-dropdown")).toBeInTheDocument();
    expect(screen.getByText("@user_one")).toBeInTheDocument();
    expect(screen.getByText("User Two")).toBeInTheDocument();
    expect(screen.getByText("@user_two")).toBeInTheDocument();
    expect(screen.getByText("User Three")).toBeInTheDocument();
  });

  it("calls switchAccount and does a full page reload on success", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
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
          linkedAccounts,
        },
        expires: "2026-12-31",
      },
      status: "authenticated",
      update: mockUpdate,
    });

    mockSwitchAccount.mockResolvedValue({ success: true, message: "Switched" });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(mockSwitchAccount).toHaveBeenCalledWith("user2");
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ switchToUserId: "user2" });
    });

    // Must do a full page reload, NOT router.refresh()
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  it("does not reload when switchAccount fails", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
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
          linkedAccounts,
        },
        expires: "2026-12-31",
      },
      status: "authenticated",
      update: mockUpdate,
    });

    mockSwitchAccount.mockResolvedValue({ success: false, message: "No linked accounts" });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    fireEvent.click(screen.getByTestId("switch-to-user_two"));

    await waitFor(() => {
      expect(mockSwitchAccount).toHaveBeenCalledWith("user2");
    });

    // Should NOT update session or reload when switch fails
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("shows add account button when onAddAccount is provided", () => {
    setupSession();

    const onAddAccount = vi.fn();
    render(<AccountSwitcher onAddAccount={onAddAccount} />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    const addButton = screen.getByTestId("add-account-button");
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(onAddAccount).toHaveBeenCalled();
  });

  it("closes dropdown on Escape key", () => {
    setupSession();

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    expect(screen.getByTestId("account-switcher-dropdown")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("account-switcher-dropdown")).not.toBeInTheDocument();
  });

  it("shows avatar image when account has avatar", () => {
    setupSession();

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    // User Three has an avatar — find <img> elements by tag
    const dropdown = screen.getByTestId("account-switcher-dropdown");
    const images = dropdown.querySelectorAll("img");
    expect(Array.from(images).some((img) => img.getAttribute("src") === "https://example.com/avatar.jpg")).toBe(true);
  });

  // --- Notification count tests ---

  it("shows total notification badge on the switcher button", () => {
    setupSession();

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 3, user3: 5 }}
      />
    );

    const badge = screen.getByTestId("account-switcher-total-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("8");
  });

  it("does not show badge when all counts are zero", () => {
    setupSession();

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 0, user3: 0 }}
      />
    );

    expect(screen.queryByTestId("account-switcher-total-badge")).not.toBeInTheDocument();
  });

  it("does not show badge when no notification counts provided", () => {
    setupSession();

    render(<AccountSwitcher />);

    expect(screen.queryByTestId("account-switcher-total-badge")).not.toBeInTheDocument();
  });

  it("shows 99+ when total count exceeds 99", () => {
    setupSession();

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 60, user3: 50 }}
      />
    );

    const badge = screen.getByTestId("account-switcher-total-badge");
    expect(badge).toHaveTextContent("99+");
  });

  it("shows per-account notification counts in the dropdown", () => {
    setupSession();

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 3, user3: 12 }}
      />
    );

    fireEvent.click(screen.getByTestId("account-switcher-button"));

    const badges = screen.getAllByTestId("notification-count");
    const badgeTexts = badges.map((b) => b.textContent);
    expect(badgeTexts).toContain("3");
    expect(badgeTexts).toContain("12");
  });

  it("does not show per-account badge for zero count", () => {
    setupSession();

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 0, user3: 5 }}
      />
    );

    fireEvent.click(screen.getByTestId("account-switcher-button"));

    // Only one per-account badge should appear (for user3)
    const dropdown = screen.getByTestId("account-switcher-dropdown");
    const badges = dropdown.querySelectorAll('[data-testid="notification-count"]');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("5");
  });

  it("refreshes notification counts when dropdown opens", async () => {
    setupSession();
    mockGetLinkedAccountNotificationCounts.mockResolvedValue({ user2: 7, user3: 2 });

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 0, user3: 0 }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("account-switcher-button"));
    });

    await waitFor(() => {
      expect(mockGetLinkedAccountNotificationCounts).toHaveBeenCalled();
    });

    await waitFor(() => {
      const badge = screen.getByTestId("account-switcher-total-badge");
      expect(badge).toHaveTextContent("9");
    });
  });

  it("refreshes notification counts on window focus", async () => {
    setupSession();
    mockGetLinkedAccountNotificationCounts.mockResolvedValue({ user2: 1, user3: 0 });

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 0, user3: 0 }}
      />
    );

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(mockGetLinkedAccountNotificationCounts).toHaveBeenCalled();
    });
  });

  it("subscribes to ably channels for linked accounts when ably is ready", () => {
    setupSession();
    vi.mocked(useAblyReady).mockReturnValue(true);

    const mockSubscribe = vi.fn();
    const mockUnsubscribe = vi.fn();
    vi.mocked(getAblyRealtimeClient).mockReturnValue({
      channels: {
        get: vi.fn().mockReturnValue({
          subscribe: mockSubscribe,
          unsubscribe: mockUnsubscribe,
        }),
      },
    } as unknown as ReturnType<typeof getAblyRealtimeClient>);

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 0, user3: 0 }}
      />
    );

    // Should subscribe to both linked account channels
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledWith("new", expect.any(Function));
  });

  it("increments count in real-time when ably message arrives", async () => {
    setupSession();
    vi.mocked(useAblyReady).mockReturnValue(true);

    let handler: ((msg: unknown) => void) | undefined;
    const mockSubscribe = vi.fn().mockImplementation((_event: string, fn: (msg: unknown) => void) => {
      handler = fn;
    });
    const mockUnsubscribe = vi.fn();
    vi.mocked(getAblyRealtimeClient).mockReturnValue({
      channels: {
        get: vi.fn().mockReturnValue({
          subscribe: mockSubscribe,
          unsubscribe: mockUnsubscribe,
        }),
      },
    } as unknown as ReturnType<typeof getAblyRealtimeClient>);

    render(
      <AccountSwitcher
        initialNotificationCounts={{ user2: 2, user3: 0 }}
      />
    );

    // Simulate an Ably message arriving
    await act(async () => {
      handler?.({});
    });

    // Total should have gone from 2 to 3
    const badge = screen.getByTestId("account-switcher-total-badge");
    expect(badge).toHaveTextContent("3");
  });
});
