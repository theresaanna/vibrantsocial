import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderAuth } from "@/components/header-auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/chat/actions", () => ({
  getConversations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/notifications/actions", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  getRecentNotifications: vi.fn().mockResolvedValue([]),
  getLinkedAccountNotificationCounts: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/account-linking-db", () => ({
  loadLinkedAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/profile/nsfw-actions", () => ({
  getNsfwContentSetting: vi.fn().mockResolvedValue(false),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/chat-nav", () => ({
  ChatNav: () => <div data-testid="chat-nav">ChatNav</div>,
}));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}));

vi.mock("@/components/dynamic-favicon", () => ({
  DynamicFavicon: () => null,
}));

vi.mock("@/components/nsfw-toggle", () => ({
  NsfwToggle: () => <div data-testid="nsfw-toggle">NSFW</div>,
}));

vi.mock("@/components/account-switcher-wrapper", () => ({
  AccountSwitcherWrapper: () => (
    <div data-testid="account-switcher">Switcher</div>
  ),
}));

vi.mock("@/components/nav-links", () => ({
  NavLinks: ({ username }: { username?: string | null }) => (
    <div data-testid="nav-links">
      <a href="/feed" aria-label="Feed">
        <svg />
      </a>
      <a href="/likes" aria-label="Likes">
        <svg />
      </a>
      <a href="/bookmarks" aria-label="Bookmarks">
        <svg />
      </a>
      <a href={username ? `/${username}` : "/profile"} aria-label="Profile">
        <svg />
      </a>
    </div>
  ),
}));

import { auth } from "@/auth";

const authedSession = {
  user: { id: "u1", name: "Test User" },
  expires: "",
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never;

describe("HeaderAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Sign In link when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const jsx = await HeaderAuth();
    render(jsx);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-links")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
  });

  it("shows nav links when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await HeaderAuth();
    render(jsx);

    expect(screen.getByLabelText("Feed")).toBeInTheDocument();
    expect(screen.getByLabelText("Likes")).toBeInTheDocument();
    expect(screen.getByLabelText("Bookmarks")).toBeInTheDocument();
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });

  it("renders notification bell and chat nav when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await HeaderAuth();
    render(jsx);

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByTestId("chat-nav")).toBeInTheDocument();
  });

  it("renders account switcher when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await HeaderAuth();
    render(jsx);

    expect(screen.getByTestId("account-switcher")).toBeInTheDocument();
  });

  it("links profile to username when available", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Jane", username: "jane" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await HeaderAuth();
    render(jsx);

    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.closest("a")).toHaveAttribute("href", "/jane");
  });

  it("falls back to /profile when username is null", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await HeaderAuth();
    render(jsx);

    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.closest("a")).toHaveAttribute("href", "/profile");
  });
});
