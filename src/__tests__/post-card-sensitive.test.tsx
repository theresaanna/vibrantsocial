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
  },
  tags: [],
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
};

describe("PostCard - sensitive/Graphic/NSFW content gating", () => {
  it("renders normal post content regardless of verification", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  // ── Graphic/Explicit content (isGraphicNudity) ─────────────────────

  it("shows locked overlay for Graphic/Explicit post when not age verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("shows Graphic/Explicit content by default when age verified and showGraphicByDefault is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={true}
        showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view graphic content")).not.toBeInTheDocument();
  });

  it("shows Graphic/Explicit badge on Graphic/Explicit post shown by default", () => {
    render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={true}
        showNsfwContent={false}
      />
    );
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  // ── NSFW content (isNsfw) ─────────────────────────────────────────

  it("shows click-to-reveal for NSFW post when showNsfwContent is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("shows NSFW content by default when showNsfwContent is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={true}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view NSFW content")).not.toBeInTheDocument();
  });

  it("shows NSFW badge on NSFW post shown by default", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={true}
      />
    );
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  // ── Combined badges ───────────────────────────────────────────────

  it("shows combined Sensitive / NSFW badge when both flags are set", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, isNsfw: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={true}
      />
    );
    // Sensitive requires click-to-reveal even when age verified, so click to reveal first
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive / NSFW")).toBeInTheDocument();
  });

  it("shows combined Sensitive / Graphic/Explicit badge when both flags are set", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true, isGraphicNudity: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={true}
        showNsfwContent={false}
      />
    );
    // Sensitive requires click-to-reveal even when age verified
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive / Graphic/Explicit")).toBeInTheDocument();
  });

  // ── Not authenticated ─────────────────────────────────────────────

  it("returns null for sensitive post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for NSFW post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for Graphic/Explicit post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isGraphicNudity: true }}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
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
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });
});
