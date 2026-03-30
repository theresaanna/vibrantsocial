import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunitiesDiscussionsClient } from "@/app/communities/communities-discussions-client";

const mockFetchTopDiscussedPosts = vi.fn();

vi.mock("@/app/communities/discussion-actions", () => ({
  fetchTopDiscussedPosts: (...args: unknown[]) => mockFetchTopDiscussedPosts(...args),
}));

vi.mock("@/components/post-card", () => ({
  PostCard: ({ post, defaultShowComments, defaultExpanded }: {
    post: { id: string };
    defaultShowComments: boolean;
    defaultExpanded: boolean;
  }) => (
    <div data-testid="post-card" data-post-id={post.id}>
      <span data-testid="default-show-comments">{String(defaultShowComments)}</span>
      <span data-testid="default-expanded">{String(defaultExpanded)}</span>
    </div>
  ),
}));

describe("CommunitiesDiscussionsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially before data loads", () => {
    mockFetchTopDiscussedPosts.mockReturnValue(new Promise(() => {}));

    render(<CommunitiesDiscussionsClient />);

    // Should show spinner, not discussions list or empty state
    expect(screen.queryByTestId("discussions-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("no-discussions")).not.toBeInTheDocument();
  });

  it("calls fetchTopDiscussedPosts on mount", () => {
    mockFetchTopDiscussedPosts.mockReturnValue(new Promise(() => {}));

    render(<CommunitiesDiscussionsClient />);

    expect(mockFetchTopDiscussedPosts).toHaveBeenCalledTimes(1);
    expect(mockFetchTopDiscussedPosts).toHaveBeenCalledWith();
  });
});
