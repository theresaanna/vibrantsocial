import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/nav-links";

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
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Compose")).toBeInTheDocument();
    expect(screen.getByLabelText("Lists")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat Rooms")).toBeInTheDocument();
    expect(screen.getByLabelText("Explore")).toBeInTheDocument();
    expect(screen.getByLabelText("Marketplace")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
    // Help is no longer in NavLinks — it's in the header next to NSFW toggle
    expect(screen.queryByLabelText("Help")).not.toBeInTheDocument();
  });

  it("links to correct hrefs", () => {
    render(<NavLinks username="testuser" />);
    expect(screen.getByLabelText("Search")).toHaveAttribute(
      "href",
      "/search"
    );
    expect(screen.getByLabelText("Home")).toHaveAttribute("href", "/feed");
    expect(screen.getByLabelText("Compose")).toHaveAttribute(
      "href",
      "/compose"
    );
    expect(screen.getByLabelText("Lists")).toHaveAttribute(
      "href",
      "/lists"
    );
    expect(screen.getByLabelText("Explore")).toHaveAttribute(
      "href",
      "/explore"
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
    expect(searchLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
  });

  it("highlights Search link using prefix matching on /search?q=test", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
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
    const feedLink = screen.getByLabelText("Home");
    expect(feedLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
  });

  it("does not highlight Feed link when on different page", () => {
    vi.mocked(usePathname).mockReturnValue("/likes");
    render(<NavLinks username="testuser" />);
    const feedLink = screen.getByLabelText("Home");
    expect(feedLink.className).toContain("text-zinc-600");
  });

  it("highlights Explore using prefix matching on /explore/sub", () => {
    vi.mocked(usePathname).mockReturnValue("/explore/sub");
    render(<NavLinks username="testuser" />);
    const exploreLink = screen.getByLabelText("Explore");
    expect(exploreLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
  });

  it("highlights Profile link when on user profile page", () => {
    vi.mocked(usePathname).mockReturnValue("/alice");
    render(<NavLinks username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toMatch(/(^| )text-fuchsia-500( |$)/);
  });

  it("does not highlight Profile link when on another user's page", () => {
    vi.mocked(usePathname).mockReturnValue("/bob");
    render(<NavLinks username="alice" />);
    const profileLink = screen.getByLabelText("Profile");
    expect(profileLink.className).toContain("text-zinc-600");
  });
});
