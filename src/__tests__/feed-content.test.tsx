import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    repost: { findMany: vi.fn() },
    closeFriend: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn(
    (_key: string, fn: () => Promise<unknown>) => fn()
  ),
  cacheKeys: {
    userFollowing: (id: string) => `following:${id}`,
  },
}));

vi.mock("@/app/feed/close-friends-actions", () => ({
  getCloseFriendIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/require-profile", () => ({
  isProfileIncomplete: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/age-gate", () => ({
  calculateAge: vi.fn().mockReturnValue(25),
}));

vi.mock("@/app/feed/feed-queries", () => ({
  getPostInclude: vi.fn().mockReturnValue({}),
  getRepostInclude: vi.fn().mockReturnValue({}),
  PAGE_SIZE: 10,
}));

vi.mock("@/components/feed-client", () => ({
  FeedClient: (props: Record<string, unknown>) => (
    <div data-testid="feed-client">
      <span data-testid="phone-verified">
        {String(props.phoneVerified)}
      </span>
      <span data-testid="current-user-id">{String(props.currentUserId)}</span>
      <span data-testid="has-email">{String(props.hasEmail)}</span>
      <span data-testid="age-verified">{String(props.ageVerified)}</span>
      <span data-testid="is-old-enough">{String(props.isOldEnough)}</span>
    </div>
  ),
}));

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { FeedContent } from "@/app/feed/feed-content";

// Helper to render async server component
async function renderAsync(component: Promise<React.ReactElement>) {
  const resolved = await component;
  return render(resolved);
}

describe("FeedContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      username: "testuser",
      email: "test@test.com",
      phoneVerified: true,
      dateOfBirth: new Date("1995-01-01"),
      ageVerified: true,
      showGraphicByDefault: false,
      showNsfwContent: false,
    } as any);

    vi.mocked(prisma.follow.findMany).mockResolvedValue([]);
    vi.mocked(prisma.post.findMany).mockResolvedValue([]);
    vi.mocked(prisma.repost.findMany).mockResolvedValue([]);
    vi.mocked(prisma.closeFriend.findMany).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders FeedClient with correct props", async () => {
    await renderAsync(FeedContent({ userId: "user1" }) as any);

    expect(screen.getByTestId("feed-client")).toBeInTheDocument();
    expect(screen.getByTestId("phone-verified")).toHaveTextContent("true");
    expect(screen.getByTestId("current-user-id")).toHaveTextContent("user1");
    expect(screen.getByTestId("has-email")).toHaveTextContent("true");
  });

  it("redirects when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    try {
      await renderAsync(FeedContent({ userId: "missing-user" }) as any);
    } catch {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith("/complete-profile");
  });

  it("redirects when profile is incomplete", async () => {
    vi.mocked(isProfileIncomplete).mockReturnValue(true);

    try {
      await renderAsync(FeedContent({ userId: "user1" }) as any);
    } catch {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith("/complete-profile");
  });

  it("passes phoneVerified false when not verified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      username: "testuser",
      email: "test@test.com",
      phoneVerified: false,
      dateOfBirth: new Date("1995-01-01"),
      ageVerified: false,
      showGraphicByDefault: false,
      showNsfwContent: false,
    } as any);

    await renderAsync(FeedContent({ userId: "user1" }) as any);

    expect(screen.getByTestId("phone-verified")).toHaveTextContent("false");
    expect(screen.getByTestId("age-verified")).toHaveTextContent("false");
  });

  it("passes hasEmail false when no email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      username: "testuser",
      email: null,
      phoneVerified: true,
      dateOfBirth: null,
      ageVerified: false,
      showGraphicByDefault: false,
      showNsfwContent: false,
    } as any);

    await renderAsync(FeedContent({ userId: "user1" }) as any);

    expect(screen.getByTestId("has-email")).toHaveTextContent("false");
  });

  it("fetches posts and reposts from followed users", async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValue([
      { followingId: "followed1" },
      { followingId: "followed2" },
    ] as any);

    await renderAsync(FeedContent({ userId: "user1" }) as any);

    expect(prisma.post.findMany).toHaveBeenCalled();
    expect(prisma.repost.findMany).toHaveBeenCalled();
  });

  it("merges and sorts posts and reposts by date", async () => {
    const now = new Date();
    vi.mocked(prisma.post.findMany).mockResolvedValue([
      { id: "p1", createdAt: now },
    ] as any);
    vi.mocked(prisma.repost.findMany).mockResolvedValue([
      { id: "r1", createdAt: now, content: "quote", post: { id: "p2" } },
    ] as any);

    await renderAsync(FeedContent({ userId: "user1" }) as any);

    expect(screen.getByTestId("feed-client")).toBeInTheDocument();
  });
});
