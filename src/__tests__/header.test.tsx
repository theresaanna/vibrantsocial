import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/app/chat/actions", () => ({
  getConversations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/notifications/actions", () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Toggle</div>,
}));

import { auth } from "@/auth";

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders logo link", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const jsx = await Header();
    render(jsx);

    const logo = screen.getByText("VibrantSocial");
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("shows Sign In link when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bookmarks")).not.toBeInTheDocument();
  });

  it("shows Bookmarks link when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Test User" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    const bookmarksLink = screen.getByLabelText("Bookmarks");
    expect(bookmarksLink).toBeInTheDocument();
    expect(bookmarksLink.closest("a")).toHaveAttribute("href", "/bookmarks");
  });

  it("shows Feed link when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Test User" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    const feedLink = screen.getByText("Feed");
    expect(feedLink.closest("a")).toHaveAttribute("href", "/feed");
  });

  it("shows profile link with display name when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Jane", displayName: "Jane D" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByText("Jane D")).toBeInTheDocument();
  });

  it("renders notification bell and chat nav when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Test User" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByTestId("chat-nav")).toBeInTheDocument();
  });

  it("renders Sign Out button when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Test User" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("bookmarks link contains bookmark icon SVG", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", name: "Test User" },
      expires: "",
    } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
    const jsx = await Header();
    render(jsx);

    const bookmarksLink = screen.getByLabelText("Bookmarks");
    const svg = bookmarksLink.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
