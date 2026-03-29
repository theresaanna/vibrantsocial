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

// Mock @tanstack/react-virtual since jsdom doesn't support window scrolling
vi.mock("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: (options: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: options.count }, (_, i) => ({
        index: i,
        start: i * 250,
        size: 250,
        key: i,
      })),
    getTotalSize: () => options.count * 250,
    measureElement: () => {},
  }),
}));

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

  it("uses virtualization for rendering items", () => {
    const posts = [
      { id: "p1", postTagId: "pt1" },
      { id: "p2", postTagId: "pt2" },
    ];
    const { container } = render(
      <TagPostList {...defaultProps} initialPosts={posts} initialHasMore={true} />
    );
    // Virtualized items use absolute positioning with translateY
    const positioned = container.querySelectorAll('[style*="position: absolute"]');
    expect(positioned.length).toBe(2);
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
