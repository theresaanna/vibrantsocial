import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/post-actions", () => ({
  PostActions: () => <div data-testid="post-actions" />,
}));

vi.mock("@/components/comment-section", () => ({
  CommentSection: () => <div data-testid="comment-section" />,
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => <div data-testid="post-revision-history" />,
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: () => <div data-testid="content-flags-info-modal" />,
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: () => false,
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

const baseAuthor = {
  id: "user1",
  username: "testuser",
  displayName: "Test User",
  name: "Test",
  image: null,
  avatar: null,
};

const baseCounts = { comments: 0, likes: 0, bookmarks: 0, reposts: 0 };

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post1",
    content: "Test content",
    createdAt: new Date(),
    isSensitive: false,
    isNsfw: false,
    isGraphicNudity: false,
    isPinned: false,
    author: baseAuthor,
    tags: [],
    _count: baseCounts,
    likes: [],
    bookmarks: [],
    reposts: [],
    comments: [],
    ...overrides,
  };
}

describe("PostCard - age verify CTA", () => {
  // ─── Sensitive content without age verification ────────────────

  it("shows 'Verify your age' link for sensitive post when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    const verifyLink = screen.getByRole("link", { name: /verify your age/i });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute("href", "/age-verify");
  });

  it("shows 'Verify your age' link for graphic post when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isGraphicNudity: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    const verifyLink = screen.getByRole("link", { name: /verify your age/i });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute("href", "/age-verify");
  });

  it("shows 'Verify your age' link for both sensitive and graphic post when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true, isGraphicNudity: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    const verifyLink = screen.getByRole("link", { name: /verify your age/i });
    expect(verifyLink).toBeInTheDocument();
    expect(verifyLink).toHaveAttribute("href", "/age-verify");
  });

  // ─── Sensitive content WITH age verification ──────────────────

  it("does NOT show 'Verify your age' for sensitive post when age verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    // Should not have the verify link
    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();

    // Should show "Show content" button instead
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });

  it("does NOT show 'Verify your age' for graphic post when age verified", () => {
    render(
      <PostCard
        post={makePost({ isGraphicNudity: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });

  // ─── NSFW content (no age verification needed) ────────────────

  it("does NOT show 'Verify your age' for NSFW-only post", () => {
    render(
      <PostCard
        post={makePost({ isNsfw: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    // NSFW doesn't require age verification — should show "Show content" not "Verify your age"
    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });

  // ─── Non-restricted content ───────────────────────────────────

  it("does NOT show 'Verify your age' for non-restricted post", () => {
    render(
      <PostCard
        post={makePost()}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
  });

  // ─── Overlay message text ─────────────────────────────────────

  it("shows correct overlay message for sensitive content when not verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(
      screen.getByText("Verify your age to view this content.")
    ).toBeInTheDocument();
  });

  it("shows correct overlay message for graphic content when not verified", () => {
    render(
      <PostCard
        post={makePost({ isGraphicNudity: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(
      screen.getByText("Verify your age to view this content.")
    ).toBeInTheDocument();
  });

  it("shows 'Click to view sensitive content' for verified user", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(
      screen.getByText("Click to view sensitive content")
    ).toBeInTheDocument();
  });

  it("shows 'Click to view NSFW content' for unverified user with NSFW post", () => {
    render(
      <PostCard
        post={makePost({ isNsfw: true })}
        currentUserId="viewer1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(
      screen.getByText("Click to view NSFW content")
    ).toBeInTheDocument();
  });

  // ─── Author bypass ─────────────────────────────────────────────

  it("does NOT show 'Verify your age' for author of sensitive post even when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true })}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });

  it("does NOT show 'Verify your age' for author of graphic post even when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isGraphicNudity: true })}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });

  it("does NOT show 'Verify your age' for author of sensitive+graphic post even when not age verified", () => {
    render(
      <PostCard
        post={makePost({ isSensitive: true, isGraphicNudity: true })}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false} hideNsfwOverlay={false}
      />
    );

    expect(screen.queryByText(/verify your age/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show content/i)).toBeInTheDocument();
  });
});
