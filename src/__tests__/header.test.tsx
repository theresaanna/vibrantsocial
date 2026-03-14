import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/chat/actions", () => ({
  getConversations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/notifications/actions", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  getRecentNotifications: vi.fn().mockResolvedValue([]),
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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Toggle</div>,
}));

vi.mock("@/components/search-bar", () => ({
  SearchBar: () => <div data-testid="search-bar">Search</div>,
}));

vi.mock("@/components/account-switcher-wrapper", () => ({
  AccountSwitcherWrapper: () => <div data-testid="account-switcher">Switcher</div>,
}));

vi.mock("@/components/nav-links", () => ({
  NavLinks: ({ username }: { username?: string | null }) => (
    <div data-testid="nav-links">
      <a href="/feed" aria-label="Feed"><svg /></a>
      <a href="/likes" aria-label="Likes"><svg /></a>
      <a href="/bookmarks" aria-label="Bookmarks"><svg /></a>
      <a href={username ? `/${username}` : "/profile"} aria-label="Profile"><svg /></a>
    </div>
  ),
  MobileProfileLink: ({ username }: { username?: string | null }) => (
    <a href={username ? `/${username}` : "/profile"} aria-label="Mobile Profile"><svg /></a>
  ),
}));

import { auth } from "@/auth";

const authedSession = {
  user: { id: "u1", name: "Test User" },
  expires: "",
} as ReturnType<typeof auth> extends Promise<infer T> ? T : never;

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders logo link", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const jsx = await Header();
    render(jsx);

    const logo = screen.getByText("Vibrant");
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("shows Sign In link when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.queryByLabelText("Feed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Likes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bookmarks")).not.toBeInTheDocument();
  });

  it("shows Feed icon link when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    const feedLink = screen.getByLabelText("Feed");
    expect(feedLink.closest("a")).toHaveAttribute("href", "/feed");
    expect(feedLink.querySelector("svg")).toBeInTheDocument();
  });

  it("shows Likes icon link when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    const likesLink = screen.getByLabelText("Likes");
    expect(likesLink.closest("a")).toHaveAttribute("href", "/likes");
    expect(likesLink.querySelector("svg")).toBeInTheDocument();
  });

  it("shows Bookmarks icon link when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    const bookmarksLink = screen.getByLabelText("Bookmarks");
    expect(bookmarksLink.closest("a")).toHaveAttribute("href", "/bookmarks");
    expect(bookmarksLink.querySelector("svg")).toBeInTheDocument();
  });

  it("shows Profile icon linking to public profile when username exists", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Jane", username: "jane" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.closest("a")).toHaveAttribute("href", "/jane");
    expect(profileLink.querySelector("svg")).toBeInTheDocument();
  });

  it("falls back to /profile when username is null", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.closest("a")).toHaveAttribute("href", "/profile");
  });

  it("renders notification bell and chat nav when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByTestId("chat-nav")).toBeInTheDocument();
  });

  it("does not render Sign Out button in header", async () => {
    vi.mocked(auth).mockResolvedValue(authedSession);
    const jsx = await Header();
    render(jsx);

    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });
});
