import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostActions } from "@/components/post-actions";

let mockToggleLike: ReturnType<typeof vi.fn>;
let mockToggleBookmark: ReturnType<typeof vi.fn>;
let mockToggleRepost: ReturnType<typeof vi.fn>;

vi.mock("@/app/feed/post-actions", () => ({
  toggleLike: (...args: unknown[]) => mockToggleLike(...args),
  toggleBookmark: (...args: unknown[]) => mockToggleBookmark(...args),
  toggleRepost: (...args: unknown[]) => mockToggleRepost(...args),
}));

const defaultProps = {
  postId: "p1",
  likeCount: 3,
  commentCount: 0,
  repostCount: 0,
  bookmarkCount: 0,
  isLiked: false,
  isBookmarked: false,
  isReposted: false,
  onToggleComments: vi.fn(),
};

describe("PostActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleLike = vi.fn().mockResolvedValue({ success: true, message: "Liked" });
    mockToggleBookmark = vi.fn().mockResolvedValue({ success: true, message: "Bookmarked" });
    mockToggleRepost = vi.fn().mockResolvedValue({ success: true, message: "Reposted" });
  });

  it("renders like count", () => {
    render(<PostActions {...defaultProps} />);
    const likeBtn = screen.getByLabelText("Like");
    expect(within(likeBtn).getByText("3")).toBeInTheDocument();
  });

  it("does not render count when zero", () => {
    render(<PostActions {...defaultProps} likeCount={0} />);
    const likeBtn = screen.getByLabelText("Like");
    expect(likeBtn.textContent?.trim()).toBe("");
  });

  it("shows filled heart when liked", () => {
    render(<PostActions {...defaultProps} isLiked={true} />);
    const likeBtn = screen.getByLabelText("Unlike");
    const svg = likeBtn.querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  it("shows outline heart when not liked", () => {
    render(<PostActions {...defaultProps} isLiked={false} />);
    const likeBtn = screen.getByLabelText("Like");
    const svg = likeBtn.querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("none");
  });

  it("optimistically increments like count on click", async () => {
    const user = userEvent.setup();
    let resolveAction!: (v: { success: boolean; message: string }) => void;
    mockToggleLike.mockReturnValue(
      new Promise((r) => { resolveAction = r; })
    );

    render(<PostActions {...defaultProps} likeCount={3} isLiked={false} />);

    const likeBtn = screen.getByLabelText("Like");
    expect(within(likeBtn).getByText("3")).toBeInTheDocument();

    await user.click(likeBtn);

    // After click: count should be 4, button should say Unlike
    const unlikeBtn = screen.getByLabelText("Unlike");
    expect(within(unlikeBtn).getByText("4")).toBeInTheDocument();

    await act(async () => {
      resolveAction({ success: true, message: "Liked" });
    });

    // Still 4
    expect(within(screen.getByLabelText("Unlike")).getByText("4")).toBeInTheDocument();
  });

  it("optimistically decrements like count on unlike", async () => {
    const user = userEvent.setup();
    mockToggleLike.mockResolvedValue({ success: true, message: "Unliked" });

    render(<PostActions {...defaultProps} likeCount={5} isLiked={true} />);

    const unlikeBtn = screen.getByLabelText("Unlike");
    expect(within(unlikeBtn).getByText("5")).toBeInTheDocument();

    await user.click(unlikeBtn);

    const likeBtn = screen.getByLabelText("Like");
    expect(within(likeBtn).getByText("4")).toBeInTheDocument();
  });

  it("reverts optimistic update on server failure", async () => {
    const user = userEvent.setup();
    let resolveAction!: (v: { success: boolean; message: string }) => void;
    mockToggleLike.mockReturnValue(
      new Promise((r) => { resolveAction = r; })
    );

    render(<PostActions {...defaultProps} likeCount={3} isLiked={false} />);

    await user.click(screen.getByLabelText("Like"));

    // Optimistic: count is 4
    expect(within(screen.getByLabelText("Unlike")).getByText("4")).toBeInTheDocument();

    // Server fails
    await act(async () => {
      resolveAction({ success: false, message: "Not authenticated" });
    });

    // Reverted: count back to 3, heart outline
    expect(within(screen.getByLabelText("Like")).getByText("3")).toBeInTheDocument();
  });

  it("calls toggleLike with postId in formData", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} />);

    await user.click(screen.getByLabelText("Like"));

    expect(mockToggleLike).toHaveBeenCalledTimes(1);
    const [, formData] = mockToggleLike.mock.calls[0];
    expect(formData.get("postId")).toBe("p1");
  });

  it("optimistically updates bookmark on click", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} bookmarkCount={2} isBookmarked={false} />);

    const bookmarkBtn = screen.getByLabelText("Bookmark");
    expect(within(bookmarkBtn).getByText("2")).toBeInTheDocument();

    await user.click(bookmarkBtn);

    const unbookmarkBtn = screen.getByLabelText("Unbookmark");
    expect(within(unbookmarkBtn).getByText("3")).toBeInTheDocument();
  });

  it("shows repost dropdown when not reposted", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} repostCount={0} isReposted={false} />);

    await user.click(screen.getByLabelText("Repost"));

    // Dropdown should appear with "Repost" and "Quote Post" options
    expect(screen.getByText("Repost")).toBeInTheDocument();
  });

  it("optimistically updates repost via dropdown", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} repostCount={0} isReposted={false} />);

    // Click repost button to open dropdown
    await user.click(screen.getByLabelText("Repost"));
    // Click "Repost" in the dropdown
    await user.click(screen.getByText("Repost"));

    const unrepostBtn = screen.getByLabelText("Unrepost");
    expect(within(unrepostBtn).getByText("1")).toBeInTheDocument();
  });

  it("shows confirmation before unreposting", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} repostCount={2} isReposted={true} />);

    // Should show Unrepost label
    const unrepostBtn = screen.getByLabelText("Unrepost");
    expect(within(unrepostBtn).getByText("2")).toBeInTheDocument();

    // Click shows confirmation instead of immediate unrepost
    await user.click(unrepostBtn);
    expect(screen.getByText("Remove your repost?")).toBeInTheDocument();

    // Click Remove to confirm
    await user.click(screen.getByText("Remove"));

    const repostBtn = screen.getByLabelText("Repost");
    expect(within(repostBtn).getByText("1")).toBeInTheDocument();
  });

  it("calls onQuotePost from dropdown", async () => {
    const onQuotePost = vi.fn();
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} isReposted={false} onQuotePost={onQuotePost} />);

    await user.click(screen.getByLabelText("Repost"));
    await user.click(screen.getByText("Quote Post"));

    expect(onQuotePost).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleComments when comment button clicked", async () => {
    const onToggleComments = vi.fn();
    const user = userEvent.setup();
    render(<PostActions {...defaultProps} onToggleComments={onToggleComments} />);

    const commentBtn = screen.getByLabelText("Toggle comments");
    await user.click(commentBtn);

    expect(onToggleComments).toHaveBeenCalledTimes(1);
  });

  it("renders a share button", () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByLabelText("Share")).toBeInTheDocument();
  });

  it("shows Copied! feedback after share click", async () => {
    // Ensure navigator.share is not available so clipboard fallback is used
    const origShare = navigator.share;
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<PostActions {...defaultProps} />);

    await user.click(screen.getByLabelText("Share"));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(navigator, "share", {
      value: origShare,
      writable: true,
      configurable: true,
    });
  });
});
