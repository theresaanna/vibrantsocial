import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedList } from "@/components/feed-list";

vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid={`post-card-${post.id}`}>{post.content}</div>
  ),
}));

vi.mock("@/components/repost-card", () => ({
  RepostCard: ({ repost }: { repost: { id: string; comment: string } }) => (
    <div data-testid={`repost-card-${repost.id}`}>{repost.comment}</div>
  ),
}));

const mockFetchFeedPage = vi.fn();

vi.mock("@/app/feed/feed-actions", () => ({
  fetchFeedPage: (...args: unknown[]) => mockFetchFeedPage(...args),
}));

// Mock IntersectionObserver for jsdom
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
vi.stubGlobal(
  "IntersectionObserver",
  vi.fn(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: vi.fn(),
  }))
);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseProps = {
  initialHasMore: false,
  currentUserId: "user1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
};

const makeFeedItem = (
  id: string,
  type: "post" | "repost" = "post",
  content = "Test content"
) => ({
  type,
  data: { id, content, comment: content },
  date: new Date().toISOString(),
});

describe("FeedList", () => {
  it("renders empty state when no items", () => {
    render(<FeedList {...baseProps} initialItems={[]} />);
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Follow people to see their posts here, or create your own!"
      )
    ).toBeInTheDocument();
  });

  it("renders post cards for post items", () => {
    const items = [makeFeedItem("p1"), makeFeedItem("p2")];
    render(<FeedList {...baseProps} initialItems={items} />);
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
  });

  it("renders repost cards for repost items", () => {
    const items = [makeFeedItem("r1", "repost", "My repost")];
    render(<FeedList {...baseProps} initialItems={items} />);
    expect(screen.getByTestId("repost-card-r1")).toBeInTheDocument();
  });

  it("renders mix of post and repost cards", () => {
    const items = [
      makeFeedItem("p1", "post"),
      makeFeedItem("r1", "repost"),
      makeFeedItem("p2", "post"),
    ];
    render(<FeedList {...baseProps} initialItems={items} />);
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
    expect(screen.getByTestId("repost-card-r1")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
  });

  it("shows 'all caught up' when hasMore is false and items exist", () => {
    const items = [makeFeedItem("p1")];
    render(
      <FeedList {...baseProps} initialItems={items} initialHasMore={false} />
    );
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
  });

  it("does not show 'all caught up' when items are empty", () => {
    render(
      <FeedList {...baseProps} initialItems={[]} initialHasMore={false} />
    );
    expect(screen.queryByText(/all caught up/)).not.toBeInTheDocument();
  });

  it("renders posts using normal flow layout with gap", () => {
    const items = [makeFeedItem("p1"), makeFeedItem("p2")];
    const { container } = render(
      <FeedList {...baseProps} initialItems={items} initialHasMore={true} />
    );
    // Posts use flex column layout, not absolute positioning
    const flexContainer = container.querySelector(".flex.flex-col.gap-4");
    expect(flexContainer).toBeInTheDocument();
    // No absolute positioning
    const positioned = container.querySelectorAll('[style*="position: absolute"]');
    expect(positioned.length).toBe(0);
  });

  it("sets up IntersectionObserver for infinite scroll", () => {
    const items = [makeFeedItem("p1")];
    render(
      <FeedList {...baseProps} initialItems={items} initialHasMore={true} />
    );
    expect(mockObserve).toHaveBeenCalled();
  });

  it("prepends new items via newItems prop", () => {
    const initialItems = [makeFeedItem("p1")];
    const newItems = [makeFeedItem("p0")];
    render(
      <FeedList {...baseProps} initialItems={initialItems} newItems={newItems} />
    );
    expect(screen.getByTestId("post-card-p0")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
  });

  it("does not duplicate existing items via newItems", () => {
    const initialItems = [makeFeedItem("p1")];
    const newItems = [makeFeedItem("p1")];
    render(
      <FeedList {...baseProps} initialItems={initialItems} newItems={newItems} />
    );
    const cards = screen.getAllByTestId("post-card-p1");
    expect(cards).toHaveLength(1);
  });
});
