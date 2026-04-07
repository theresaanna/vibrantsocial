import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/post-actions", () => ({
  PostActions: () => <div data-testid="post-actions">actions</div>,
}));

vi.mock("@/components/comment-section", () => ({
  CommentSection: () => <div data-testid="comment-section">comments</div>,
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => <div data-testid="post-revision-history" />,
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="mock-editor" />,
}));

vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  clearDraft: vi.fn(),
}));

vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: () => <div data-testid="content-flags-info-modal" />,
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

const basePost = {
  id: "post1",
  content: "Test content",
  createdAt: new Date(),
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  isPinned: false,
  author: {
    id: "user1",
    username: "testuser",
    displayName: "Test User",
    name: "Test",
    image: null,
    avatar: null,
    profileFrameId: null,
  },
  tags: [],
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
};

const defaultProps = {
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
};

describe("PostCard - sensitive/Graphic/NSFW content gating", () => {
  it("renders normal post content regardless of verification", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Verify your age to view this content.")).not.toBeInTheDocument();
  });

  // ── Sensitive content (isSensitive) ───────────────────────────────

  it("shows locked overlay for sensitive post when not age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="viewer1"
        {...defaultProps}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    expect(screen.queryByText("Show content")).not.toBeInTheDocument();
  });

  it("shows click-to-reveal for sensitive post when age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
      />
    );
    expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("reveals sensitive content after clicking show button", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view sensitive content")).not.toBeInTheDocument();
  });

  it("shows Sensitive badge on revealed sensitive post", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  it("hides sensitive overlay when hideSensitiveOverlay is true and age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view sensitive content")).not.toBeInTheDocument();
  });

  it("still requires age verification for sensitive even with hideSensitiveOverlay", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="viewer1"
        {...defaultProps}
        ageVerified={false}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("shows Sensitive badge when hideSensitiveOverlay bypasses overlay", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
      />
    );
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  // ── Graphic/Explicit content (isGraphicNudity) ─────────────────────

  it("shows locked overlay for Graphic/Explicit post when not age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="viewer1"
        {...defaultProps}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    expect(screen.queryByText("Show content")).not.toBeInTheDocument();
  });

  it("shows click-to-reveal for Graphic/Explicit post when age verified and showGraphicByDefault is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
      />
    );
    expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("hides Graphic/Explicit overlay when showGraphicByDefault is true and age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showGraphicByDefault={true}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view graphic content")).not.toBeInTheDocument();
  });

  it("shows Graphic/Explicit badge when overlay is hidden via opt-in", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showGraphicByDefault={true}
      />
    );
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("still requires age verification for Graphic/Explicit even with showGraphicByDefault", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="viewer1"
        {...defaultProps}
        showGraphicByDefault={true}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  // ── NSFW content (isNsfw) ─────────────────────────────────────────

  it("shows click-to-reveal for NSFW post when showNsfwContent is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("always shows NSFW overlay even when showNsfwContent is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
        showNsfwContent={true}
      />
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("reveals NSFW content after clicking show button", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
        showNsfwContent={true}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view NSFW content")).not.toBeInTheDocument();
  });

  it("shows NSFW badge after revealing content", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
        showNsfwContent={true}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  // ── Combined flags ──────────────────────────────────────────────────

  it("shows combined Sensitive / NSFW badge when both flags are set", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showNsfwContent={true}
      />
    );
    // Sensitive overlay takes priority; click to reveal
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive / NSFW")).toBeInTheDocument();
  });

  it("shows combined Sensitive / Graphic/Explicit badge when both flags are set", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showGraphicByDefault={true}
      />
    );
    // Sensitive overlay takes priority; click to reveal
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive / Graphic/Explicit")).toBeInTheDocument();
  });

  it("shows NSFW overlay on post with both NSFW and Graphic flags when graphic overlay is hidden", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showGraphicByDefault={true}
      />
    );
    // NSFW overlay should still show since NSFW always has overlay
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
  });

  it("shows all three flags in badge when all content types are set", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, isNsfw: true, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
        showGraphicByDefault={true}
      />
    );
    // NSFW overlay still shows even though others are opted out
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive / NSFW / Graphic/Explicit")).toBeInTheDocument();
  });

  // ── Overlay opt-in interactions ─────────────────────────────────────

  it("hideSensitiveOverlay does not affect Graphic/Explicit overlay", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
      />
    );
    expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("showGraphicByDefault does not affect Sensitive overlay", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
        ageVerified={true}
        showGraphicByDefault={true}
      />
    );
    expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("no overlay opt-in exists for NSFW - overlay always shows", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        {...defaultProps}
        showNsfwContent={true}
        hideSensitiveOverlay={true} hideNsfwOverlay={false}
        showGraphicByDefault={true}
      />
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  // ── Authors can reveal their own posts ──────────────────────────────

  it("author can reveal their own sensitive post without age verification", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, author: { ...basePost.author, id: "author1" } }}
        currentUserId="author1"
        {...defaultProps}
      />
    );
    // Author should see click-to-reveal, not age-verify lock
    expect(screen.queryByText("Verify your age to view this content.")).not.toBeInTheDocument();
  });

  it("author can reveal their own graphic post without age verification", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true, author: { ...basePost.author, id: "author1" } }}
        currentUserId="author1"
        {...defaultProps}
      />
    );
    expect(screen.queryByText("Verify your age to view this content.")).not.toBeInTheDocument();
  });

  // ── Not authenticated ─────────────────────────────────────────────

  it("returns null for sensitive post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        {...defaultProps}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for NSFW post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        {...defaultProps}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for Graphic/Explicit post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        {...defaultProps}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  // ── General ───────────────────────────────────────────────────────

  it("always shows author header even when content is hidden", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  // ── Custom audience lock icon ─────────────────────────────────────

  it("shows lock icon badge for custom audience posts", () => {
    render(
      <PostCard
        post={{ ...basePost, hasCustomAudience: true }}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    const badge = screen.getByTitle("Custom audience");
    expect(badge).toBeInTheDocument();
  });

  it("does not show lock icon for posts without custom audience", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.queryByTitle("Custom audience")).not.toBeInTheDocument();
  });

  it("does not show lock icon when hasCustomAudience is false", () => {
    render(
      <PostCard
        post={{ ...basePost, hasCustomAudience: false }}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.queryByTitle("Custom audience")).not.toBeInTheDocument();
  });

  it("shows lock icon alongside other content flags", () => {
    render(
      <PostCard
        post={{ ...basePost, isCloseFriendsOnly: true, hasCustomAudience: true }}
        currentUserId="user1"
        {...defaultProps}
      />
    );
    expect(screen.getByTitle("Custom audience")).toBeInTheDocument();
  });
});
