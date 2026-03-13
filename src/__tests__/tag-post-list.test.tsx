import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetPostsByTag = vi.fn();

vi.mock("@/app/tags/actions", () => ({
  getPostsByTag: (...args: unknown[]) => mockGetPostsByTag(...args),
}));

vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string } }) => (
    <div data-testid={`post-card-${post.id}`}>Post {post.id}</div>
  ),
}));

import { TagPostList } from "@/app/tag/[name]/tag-post-list";

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(private callback: IntersectionObserverCallback) {}
  triggerIntersect() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

const defaultProps = {
  tagName: "javascript",
  initialPosts: [] as Array<{ id: string; postTagId?: string }>,
  initialHasMore: false,
  currentUserId: "user1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
};

describe("TagPostList", () => {
  let mockObserverInstance: MockIntersectionObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = vi.fn((callback) => {
      mockObserverInstance = new MockIntersectionObserver(callback);
      return mockObserverInstance as unknown as IntersectionObserver;
    }) as unknown as typeof IntersectionObserver;
  });

  // ─── Empty state ───────────────────────────────────────────

  it("shows empty state when no posts", () => {
    render(<TagPostList {...defaultProps} />);
    expect(
      screen.getByText("No posts with this tag yet.")
    ).toBeInTheDocument();
  });

  it("does not render sentinel in empty state", () => {
    const { container } = render(<TagPostList {...defaultProps} />);
    expect(container.querySelector(".h-1")).not.toBeInTheDocument();
  });

  // ─── With posts ────────────────────────────────────────────

  it("renders post cards for initial posts", () => {
    const posts = [
      { id: "p1", postTagId: "pt1" },
      { id: "p2", postTagId: "pt2" },
    ];
    render(<TagPostList {...defaultProps} initialPosts={posts} />);
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
  });

  it("renders sentinel div when there are posts", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    const { container } = render(
      <TagPostList {...defaultProps} initialPosts={posts} />
    );
    expect(container.querySelector(".h-1")).toBeInTheDocument();
  });

  it("does not show empty state when posts exist", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    render(<TagPostList {...defaultProps} initialPosts={posts} />);
    expect(
      screen.queryByText("No posts with this tag yet.")
    ).not.toBeInTheDocument();
  });

  // ─── Infinite scroll ──────────────────────────────────────

  it("sets up IntersectionObserver when posts exist", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    render(
      <TagPostList
        {...defaultProps}
        initialPosts={posts}
        initialHasMore={true}
      />
    );
    expect(global.IntersectionObserver).toHaveBeenCalled();
    expect(mockObserverInstance.observe).toHaveBeenCalled();
  });

  it("renders without currentUserId", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    render(
      <TagPostList
        {...defaultProps}
        initialPosts={posts}
        currentUserId={undefined}
      />
    );
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
  });
});
