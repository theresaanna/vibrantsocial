import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedTabs } from "@/components/feed-tabs";

vi.mock("ably/react", () => ({
  useChannel: vi.fn(),
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: () => false,
}));

describe("FeedTabs - For You tab", () => {
  it("renders For You tab", () => {
    render(<FeedTabs lists={[]} />);
    expect(screen.getByText("For You")).toBeInTheDocument();
  });

  it("links to /feed?list=for-you", () => {
    render(<FeedTabs lists={[]} />);
    const link = screen.getByText("For You").closest("a");
    expect(link).toHaveAttribute("href", "/feed?list=for-you");
  });

  it("highlights For You tab when active", () => {
    render(<FeedTabs lists={[]} activeListId="for-you" />);
    const forYouLink = screen.getByText("For You");
    expect(forYouLink.className).toContain("bg-white");
  });

  it("does not highlight For You tab when other tab is active", () => {
    render(<FeedTabs lists={[]} activeListId="close-friends" />);
    const forYouLink = screen.getByText("For You");
    expect(forYouLink.className).not.toContain("bg-white");
  });

  it("renders For You between Feed and Close Friends", () => {
    render(<FeedTabs lists={[]} />);
    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent);
    const feedIdx = labels.indexOf("Feed");
    const forYouIdx = labels.indexOf("For You");
    const closeFriendsIdx = labels.indexOf("Close Friends");
    expect(forYouIdx).toBeGreaterThan(feedIdx);
    expect(forYouIdx).toBeLessThan(closeFriendsIdx);
  });
});

describe("fetchForYouPage", () => {
  const mockAuth = vi.fn();
  const mockFindMany = vi.fn();
  const mockFollowFindMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  vi.mock("@/auth", () => ({
    auth: () => mockAuth(),
  }));

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      post: { findMany: (...args: unknown[]) => mockFindMany(...args) },
      follow: { findMany: (...args: unknown[]) => mockFollowFindMany(...args) },
    },
  }));

  vi.mock("@/lib/cache", () => ({
    cached: (_key: string, fn: () => unknown) => fn(),
    cacheKeys: { userFollowing: (id: string) => `following:${id}` },
  }));

  vi.mock("@/app/feed/block-actions", () => ({
    getAllBlockRelatedIds: () => Promise.resolve([]),
  }));

  vi.mock("@/lib/user-prefs", () => ({
    getUserPrefs: () =>
      Promise.resolve({ showNsfwContent: false, ageVerified: false, hideWallFromFeed: false }),
  }));

  it("returns empty items when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { fetchForYouPage } = await import("@/app/feed/for-you-actions");
    const result = await fetchForYouPage();
    expect(result).toEqual({ items: [], hasMore: false });
  });

  it("excludes followed users and self from results", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFollowFindMany.mockResolvedValue([
      { followingId: "followed1" },
      { followingId: "followed2" },
    ]);
    mockFindMany.mockResolvedValue([]);

    const { fetchForYouPage } = await import("@/app/feed/for-you-actions");
    await fetchForYouPage();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authorId: { notIn: expect.arrayContaining(["user1", "followed1", "followed2"]) },
        }),
      })
    );
  });

  it("filters out NSFW posts when user has not opted in", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFollowFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const { fetchForYouPage } = await import("@/app/feed/for-you-actions");
    await fetchForYouPage();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isNsfw: false,
          isSensitive: false,
          isGraphicNudity: false,
        }),
      })
    );
  });

  it("excludes close-friends-only, custom-audience, and logged-in-only posts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFollowFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const { fetchForYouPage } = await import("@/app/feed/for-you-actions");
    await fetchForYouPage();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isCloseFriendsOnly: false,
          hasCustomAudience: false,
          isLoggedInOnly: false,
        }),
      })
    );
  });

  it("only fetches posts from the last 7 days", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockFollowFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    const { fetchForYouPage } = await import("@/app/feed/for-you-actions");
    await fetchForYouPage();

    const callArgs = mockFindMany.mock.calls[0][0];
    const gte = callArgs.where.createdAt.gte;
    expect(gte).toBeInstanceOf(Date);
    const daysDiff = (Date.now() - gte.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThanOrEqual(6.9);
    expect(daysDiff).toBeLessThanOrEqual(7.1);
  });
});
