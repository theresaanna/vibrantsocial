import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedClient } from "@/components/feed-client";

vi.mock("@/components/add-to-home-banner", () => ({
  AddToHomeBanner: () => <div data-testid="add-to-home-banner" />,
}));

vi.mock("@/components/add-email-banner", () => ({
  AddEmailBanner: ({ hasEmail }: { hasEmail: boolean }) => (
    <div data-testid="add-email-banner" data-has-email={String(hasEmail)} />
  ),
}));

vi.mock("@/components/post-composer", () => ({
  PostComposer: ({
    phoneVerified,
    isOldEnough,
  }: {
    phoneVerified: boolean;
    isOldEnough: boolean;
  }) => (
    <div
      data-testid="post-composer"
      data-phone-verified={String(phoneVerified)}
      data-old-enough={String(isOldEnough)}
    />
  ),
}));

vi.mock("@/components/feed-list", () => ({
  FeedList: ({
    initialItems,
    initialHasMore,
  }: {
    initialItems: unknown[];
    initialHasMore: boolean;
  }) => (
    <div
      data-testid="feed-list"
      data-items-count={initialItems.length}
      data-has-more={String(initialHasMore)}
    />
  ),
}));

const mockFetchSinglePost = vi.fn();
const mockFetchNewFeedItems = vi.fn().mockResolvedValue([]);

vi.mock("@/app/feed/feed-actions", () => ({
  fetchSinglePost: (...args: unknown[]) => mockFetchSinglePost(...args),
  fetchNewFeedItems: (...args: unknown[]) => mockFetchNewFeedItems(...args),
}));

const defaultProps = {
  phoneVerified: true,
  isOldEnough: true,
  initialItems: [] as { type: "post" | "repost"; data: { id: string }; date: string }[],
  initialHasMore: false,
  currentUserId: "user1",
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hasEmail: true,
};

describe("FeedClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AddToHomeBanner", () => {
    render(<FeedClient {...defaultProps} />);
    expect(screen.getByTestId("add-to-home-banner")).toBeInTheDocument();
  });

  it("renders AddEmailBanner with hasEmail prop", () => {
    render(<FeedClient {...defaultProps} hasEmail={false} />);
    const banner = screen.getByTestId("add-email-banner");
    expect(banner).toHaveAttribute("data-has-email", "false");
  });

  it("renders PostComposer with correct props", () => {
    render(<FeedClient {...defaultProps} phoneVerified={false} isOldEnough={true} />);
    const composer = screen.getByTestId("post-composer");
    expect(composer).toHaveAttribute("data-phone-verified", "false");
    expect(composer).toHaveAttribute("data-old-enough", "true");
  });

  it("renders FeedList with initial items and hasMore", () => {
    const items = [
      { type: "post" as const, data: { id: "p1" }, date: new Date().toISOString() },
    ];
    render(
      <FeedClient {...defaultProps} initialItems={items} initialHasMore={true} />
    );
    const feedList = screen.getByTestId("feed-list");
    expect(feedList).toHaveAttribute("data-items-count", "1");
    expect(feedList).toHaveAttribute("data-has-more", "true");
  });

  it("renders all three components together", () => {
    render(<FeedClient {...defaultProps} />);
    expect(screen.getByTestId("add-to-home-banner")).toBeInTheDocument();
    expect(screen.getByTestId("add-email-banner")).toBeInTheDocument();
    expect(screen.getByTestId("post-composer")).toBeInTheDocument();
    expect(screen.getByTestId("feed-list")).toBeInTheDocument();
  });
});
