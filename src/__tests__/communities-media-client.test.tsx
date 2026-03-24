import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunitiesMediaClient } from "@/app/communities/communities-media-client";

const mockFetchCommunitiesMediaPage = vi.fn();

vi.mock("@/app/communities/media-actions", () => ({
  fetchCommunitiesMediaPage: (...args: unknown[]) => mockFetchCommunitiesMediaPage(...args),
}));

vi.mock("@/components/media-grid", () => ({
  MediaGrid: ({ initialPosts, initialHasMore }: { initialPosts: unknown[]; initialHasMore: boolean }) => (
    <div data-testid="media-grid">
      <span data-testid="post-count">{initialPosts.length}</span>
      <span data-testid="has-more">{String(initialHasMore)}</span>
    </div>
  ),
}));

describe("CommunitiesMediaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially before data loads", () => {
    // Never resolve to keep in loading state
    mockFetchCommunitiesMediaPage.mockReturnValue(new Promise(() => {}));

    render(<CommunitiesMediaClient />);

    // Should show spinner, not media grid
    expect(screen.queryByTestId("media-grid")).not.toBeInTheDocument();
  });

  it("calls fetchCommunitiesMediaPage on mount", () => {
    mockFetchCommunitiesMediaPage.mockReturnValue(new Promise(() => {}));

    render(<CommunitiesMediaClient />);

    expect(mockFetchCommunitiesMediaPage).toHaveBeenCalledTimes(1);
    expect(mockFetchCommunitiesMediaPage).toHaveBeenCalledWith();
  });
});
