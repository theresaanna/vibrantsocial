import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { NavLinks, MobileProfileLink } from "@/components/nav-links";

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

describe("NavLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders all nav links", () => {
    render(<NavLinks username="testuser" />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Feed")).toBeInTheDocument();
    expect(screen.getByLabelText("Compose")).toBeInTheDocument();
    expect(screen.getByLabelText("Likes")).toBeInTheDocument();
    expect(screen.getByLabelText("Bookmarks")).toBeInTheDocument();
    expect(screen.getByLabelText("Close Friends")).toBeInTheDocument();
    expect(screen.getByLabelText("Communities")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
  });

  it("links to correct hrefs", () => {
    render(<NavLinks username="testuser" />);
    expect(screen.getByLabelText("Search")).toHaveAttribute(
      "href",
      "/search"
    );
    expect(screen.getByLabelText("Feed")).toHaveAttribute("href", "/feed");
    expect(screen.getByLabelText("Compose")).toHaveAttribute(
      "href",
      "/compose"
    );
    expect(screen.getByLabelText("Likes")).toHaveAttribute("href", "/likes");
    expect(screen.getByLabelText("Bookmarks")).toHaveAttribute(
      "href",
      "/bookmarks"
    );
    expect(screen.getByLabelText("Close Friends")).toHaveAttribute(
      "href",
      "/close-friends"
    );
    expect(screen.getByLabelText("Communities")).toHaveAttribute(
      "href",
      "/communities"
    );
  });

  it("uses username for profile link when provided", () => {
    render(<NavLinks username="alice" />);
    expect(screen.getByLabelText("Profile")).toHaveAttribute("href", "/alice");
  });

  it("falls back to /profile when username is null", () => {
    render(<NavLinks username={null} />);
    expect(screen.getByLabelText("Profile")).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("falls back to /profile when username is undefined", () => {
    render(<NavLinks />);
    expect(screen.getByLabelText("Profile")).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("highlights Search link when on /search", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toMatch(/(^| )text-teal-500( |$)/);
  });

  it("highlights Search link using prefix matching on /search?q=test", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toMatch(/(^| )text-teal-500( |$)/);
  });

  it("does not highlight Search link when on different page", () => {
    vi.mocked(usePathname).mockReturnValue("/feed");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toContain("text-zinc-600");
  });

  it("highlights Feed link when on /feed", () => {
    vi.mocked(usePathname).mockReturnValue("/feed");
    render(<NavLinks username="testuser" />);
    const feedLink = screen.getByLabelText("Feed");
    // Active state: class includes "text-purple-500" (not as hover: variant)
    expect(feedLink.className).toMatch(/(^| )text-purple-500( |$)/);
  });

  it("does not highlight Feed link when on different page", () => {
    vi.mocked(usePathname).mockReturnValue("/likes");
    render(<NavLinks username="testuser" />);
    const feedLink = screen.getByLabelText("Feed");
    // Inactive: should have text-zinc-600, not standalone text-purple-500
    expect(feedLink.className).toContain("text-zinc-600");
  });

  it("highlights Likes link when on /likes", () => {
    vi.mocked(usePathname).mockReturnValue("/likes");
    render(<NavLinks username="testuser" />);
    const likesLink = screen.getByLabelText("Likes");
    expect(likesLink.className).toMatch(/(^| )text-red-500( |$)/);
  });

  it("highlights Bookmarks link when on /bookmarks", () => {
    vi.mocked(usePathname).mockReturnValue("/bookmarks");
    render(<NavLinks username="testuser" />);
    const bookmarksLink = screen.getByLabelText("Bookmarks");
    expect(bookmarksLink.className).toMatch(/(^| )text-yellow-500( |$)/);
  });

  it("highlights Close Friends using prefix matching on /close-friends/settings", () => {
    vi.mocked(usePathname).mockReturnValue("/close-friends/settings");
    render(<NavLinks username="testuser" />);
    const closeFriendsLink = screen.getByLabelText("Close Friends");
    expect(closeFriendsLink.className).toMatch(/(^| )text-green-500( |$)/);
  });

  it("highlights Communities using prefix matching on /communities/sub", () => {
    vi.mocked(usePathname).mockReturnValue("/communities/sub");
    render(<NavLinks username="testuser" />);
    const communitiesLink = screen.getByLabelText("Communities");
    expect(communitiesLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
  });

  it("highlights Profile link when on user profile page", () => {
    vi.mocked(usePathname).mockReturnValue("/alice");
    render(<NavLinks username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toMatch(/(^| )text-orange-500( |$)/);
  });

  it("does not highlight Profile link when on another user's page", () => {
    vi.mocked(usePathname).mockReturnValue("/bob");
    render(<NavLinks username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toContain("text-zinc-600");
  });
});

describe("MobileProfileLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("uses username for href when provided", () => {
    render(<MobileProfileLink username="alice" />);
    expect(screen.getByLabelText("Profile")).toHaveAttribute("href", "/alice");
  });

  it("falls back to /profile when username is null", () => {
    render(<MobileProfileLink username={null} />);
    expect(screen.getByLabelText("Profile")).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("highlights when on own profile page", () => {
    vi.mocked(usePathname).mockReturnValue("/alice");
    render(<MobileProfileLink username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toMatch(/(^| )text-orange-500( |$)/);
  });

  it("does not highlight when on different page", () => {
    vi.mocked(usePathname).mockReturnValue("/feed");
    render(<MobileProfileLink username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toContain("text-zinc-600");
  });
});
