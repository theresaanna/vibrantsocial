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

import { TagPostList } from "@/app/tag/[name]/tag-post-list";

const defaultProps = {
  tagName: "javascript",
  initialPosts: [] as Array<{ id: string; postTagId?: string }>,
  initialHasMore: false,
  currentUserId: "user1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagPostList", () => {
  // ─── Empty state ───────────────────────────────────────────

  it("shows empty state when no posts", () => {
    render(<TagPostList {...defaultProps} />);
    expect(
      screen.getByText("No posts with this tag yet.")
    ).toBeInTheDocument();
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

  it("does not show empty state when posts exist", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    render(<TagPostList {...defaultProps} initialPosts={posts} />);
    expect(
      screen.queryByText("No posts with this tag yet.")
    ).not.toBeInTheDocument();
  });

  it("uses flow layout with gap for rendering items", () => {
    const posts = [
      { id: "p1", postTagId: "pt1" },
      { id: "p2", postTagId: "pt2" },
    ];
    const { container } = render(
      <TagPostList {...defaultProps} initialPosts={posts} initialHasMore={true} />
    );
    // Posts use flex column layout, not absolute positioning
    const flexContainer = container.querySelector(".flex.flex-col.gap-4");
    expect(flexContainer).toBeInTheDocument();
    const positioned = container.querySelectorAll('[style*="position: absolute"]');
    expect(positioned.length).toBe(0);
  });

  it("sets up IntersectionObserver for infinite scroll", () => {
    const posts = [{ id: "p1", postTagId: "pt1" }];
    render(
      <TagPostList {...defaultProps} initialPosts={posts} initialHasMore={true} />
    );
    expect(mockObserve).toHaveBeenCalled();
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
