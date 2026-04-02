import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock prisma
const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Mock notFound
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("notFound");
  },
}));

// Mock user-theme
vi.mock("@/lib/user-theme", () => ({
  userThemeSelect: { id: true, tier: true },
  buildUserTheme: () => ({
    hasCustomTheme: false,
    themeStyle: undefined,
    bgImageStyle: undefined,
    sparklefallProps: null,
  }),
}));

// Mock ThemedPage
vi.mock("@/components/themed-page", () => ({
  ThemedPage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="themed-page">{children}</div>
  ),
}));

// Mock FramedAvatar
vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => (
    <div data-testid="framed-avatar">{alt}</div>
  ),
}));

// Mock StyledName
vi.mock("@/components/styled-name", () => ({
  StyledName: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="styled-name">{children}</span>
  ),
}));

// Mock InAppBrowserBreakout — renders children directly in tests
vi.mock("@/app/links/[username]/in-app-browser-breakout", () => ({
  InAppBrowserBreakout: ({
    children,
  }: {
    sensitiveLinks: boolean;
    children: React.ReactNode;
  }) => <div data-testid="breakout-wrapper">{children}</div>,
}));

// Mock next/link
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

import LinksPage from "@/app/links/[username]/page";

describe("LinksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user links page with avatar, name, bio, and links", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      tier: "free",
      username: "alice",
      displayName: "Alice",
      name: "Alice",
      avatar: "https://example.com/avatar.jpg",
      image: null,
      profileFrameId: null,
      usernameFont: null,
      linksPageEnabled: true,
      linksPageSensitiveLinks: false,
      linksPageBio: "Hello world",
      linksPageLinks: [
        { id: "l1", title: "My Website", url: "https://example.com" },
        { id: "l2", title: "Twitter", url: "https://twitter.com/alice" },
      ],
    });

    const Page = await LinksPage({ params: Promise.resolve({ username: "alice" }) });
    render(Page);

    expect(screen.getByTestId("themed-page")).toBeInTheDocument();
    expect(screen.getByTestId("framed-avatar")).toBeInTheDocument();
    expect(screen.getByTestId("styled-name")).toHaveTextContent("Alice");
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("My Website")).toBeInTheDocument();
    expect(screen.getByText("Twitter")).toBeInTheDocument();

    // Links point to correct URLs
    const myWebsite = screen.getByText("My Website");
    expect(myWebsite.closest("a")).toHaveAttribute("href", "https://example.com");
    const twitter = screen.getByText("Twitter");
    expect(twitter.closest("a")).toHaveAttribute("href", "https://twitter.com/alice");

    // Footer link exists
    expect(screen.getByText("vibrantsocial.app")).toHaveAttribute(
      "href",
      "https://vibrantsocial.app"
    );
  });

  it("calls notFound when user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      LinksPage({ params: Promise.resolve({ username: "nobody" }) })
    ).rejects.toThrow("notFound");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when linksPageEnabled is false", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      tier: "free",
      username: "alice",
      linksPageEnabled: false,
      linksPageBio: null,
      linksPageLinks: [],
    });

    await expect(
      LinksPage({ params: Promise.resolve({ username: "alice" }) })
    ).rejects.toThrow("notFound");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders without bio when linksPageBio is null", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      tier: "free",
      username: "bob",
      displayName: "Bob",
      name: "Bob",
      avatar: null,
      image: null,
      profileFrameId: null,
      usernameFont: null,
      linksPageEnabled: true,
      linksPageSensitiveLinks: false,
      linksPageBio: null,
      linksPageLinks: [],
    });

    const Page = await LinksPage({ params: Promise.resolve({ username: "bob" }) });
    render(Page);

    expect(screen.getByTestId("styled-name")).toHaveTextContent("Bob");
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument();
  });

  it("renders all link items with data-testid", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      tier: "free",
      username: "carol",
      displayName: "Carol",
      name: "Carol",
      avatar: null,
      image: null,
      profileFrameId: null,
      usernameFont: null,
      linksPageEnabled: true,
      linksPageSensitiveLinks: false,
      linksPageBio: null,
      linksPageLinks: [
        { id: "l1", title: "Link 1", url: "https://one.com" },
        { id: "l2", title: "Link 2", url: "https://two.com" },
        { id: "l3", title: "Link 3", url: "https://three.com" },
      ],
    });

    const Page = await LinksPage({ params: Promise.resolve({ username: "carol" }) });
    render(Page);

    const links = screen.getAllByTestId("links-page-link");
    expect(links).toHaveLength(3);
  });
});
