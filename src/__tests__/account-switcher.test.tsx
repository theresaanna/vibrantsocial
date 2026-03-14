import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRefresh = vi.fn();
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

import { useSession } from "next-auth/react";
import { switchAccount } from "@/app/profile/account-linking-actions";
import { AccountSwitcher } from "@/components/account-switcher";

const mockUseSession = vi.mocked(useSession);
const mockSwitchAccount = vi.mocked(switchAccount);

const linkedAccounts = [
  { id: "user2", username: "user_two", displayName: "User Two", avatar: null },
  { id: "user3", username: "user_three", displayName: "User Three", avatar: "https://example.com/avatar.jpg" },
];

describe("AccountSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      update: vi.fn(),
    });

    render(<AccountSwitcher />);
    expect(screen.getByTestId("account-switcher-button")).toBeInTheDocument();
  });

  it("opens dropdown on click and shows linked accounts", () => {
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
      update: vi.fn(),
    });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    expect(screen.getByTestId("account-switcher-dropdown")).toBeInTheDocument();
    expect(screen.getByText("@user_one")).toBeInTheDocument();
    expect(screen.getByText("User Two")).toBeInTheDocument();
    expect(screen.getByText("@user_two")).toBeInTheDocument();
    expect(screen.getByText("User Three")).toBeInTheDocument();
  });

  it("calls switchAccount when clicking a linked account", async () => {
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
  });

  it("shows add account button when onAddAccount is provided", () => {
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
      update: vi.fn(),
    });

    const onAddAccount = vi.fn();
    render(<AccountSwitcher onAddAccount={onAddAccount} />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    const addButton = screen.getByTestId("add-account-button");
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(onAddAccount).toHaveBeenCalled();
  });

  it("closes dropdown on Escape key", () => {
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
      update: vi.fn(),
    });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));
    expect(screen.getByTestId("account-switcher-dropdown")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("account-switcher-dropdown")).not.toBeInTheDocument();
  });

  it("shows avatar image when account has avatar", () => {
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
      update: vi.fn(),
    });

    render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    // User Three has an avatar — find <img> elements by tag
    const dropdown = screen.getByTestId("account-switcher-dropdown");
    const images = dropdown.querySelectorAll("img");
    expect(Array.from(images).some((img) => img.getAttribute("src") === "https://example.com/avatar.jpg")).toBe(true);
  });
});
