import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="mock-editor" />,
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
  editPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
  deletePost: vi.fn().mockResolvedValue({ success: true, message: "" }),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

vi.mock("@/app/feed/wall-post-actions", () => ({
  updateWallPostStatus: vi.fn().mockResolvedValue({ success: true, message: "" }),
  deleteWallPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

import { PostCard } from "@/components/post-card";

const basePost = {
  id: "post1",
  content: "Test wall post content",
  createdAt: new Date(),
  editedAt: null,
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  isPinned: false,
  author: {
    id: "poster1",
    username: "poster",
    displayName: "Poster User",
    name: "Poster",
    image: null,
    avatar: null,
    profileFrameId: null,
  },
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
  tags: [],
};

const defaultProps = {
  currentUserId: "viewer1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
};

describe("PostCard - wall post banner", () => {
  it("renders wall post banner when wallOwner is provided", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="accepted"
      />
    );

    expect(screen.getByTestId("wall-post-banner")).toBeInTheDocument();
    // Poster name appears in both the banner and the author header
    const banner = screen.getByTestId("wall-post-banner");
    expect(banner).toHaveTextContent("Poster User");
    expect(banner).toHaveTextContent(/Wall Owner.*wall/);
  });

  it("does not render wall post banner when wallOwner is not provided", () => {
    render(
      <PostCard post={basePost} {...defaultProps} />
    );

    expect(screen.queryByTestId("wall-post-banner")).not.toBeInTheDocument();
  });

  it("shows pending badge for pending wall posts", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="pending"
      />
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("does not show pending badge for accepted wall posts", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="accepted"
      />
    );

    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("links to poster profile in wall post banner", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="accepted"
      />
    );

    const banner = screen.getByTestId("wall-post-banner");
    const posterLink = banner.querySelector('a[href="/poster"]');
    expect(posterLink).toBeInTheDocument();
  });

  it("links to wall owner profile in wall post banner", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="accepted"
      />
    );

    const banner = screen.getByTestId("wall-post-banner");
    const ownerLink = banner.querySelector('a[href="/wallowner"]');
    expect(ownerLink).toBeInTheDocument();
  });
});

describe("PostCard - wall post moderation", () => {
  it("shows moderation controls for wall owner", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="pending"
        isWallOwner={true}
      />
    );

    expect(screen.getByTestId("wall-post-moderation")).toBeInTheDocument();
    expect(screen.getByTestId("wall-post-accept-btn")).toBeInTheDocument();
    expect(screen.getByTestId("wall-post-hide-btn")).toBeInTheDocument();
    expect(screen.getByTestId("wall-post-delete-btn")).toBeInTheDocument();
  });

  it("does not show moderation controls for non-wall-owner", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="pending"
        isWallOwner={false}
      />
    );

    expect(screen.queryByTestId("wall-post-moderation")).not.toBeInTheDocument();
  });

  it("does not show accept button for already accepted posts", () => {
    render(
      <PostCard
        post={basePost}
        {...defaultProps}
        wallOwner={{ username: "wallowner", displayName: "Wall Owner" }}
        wallPostId="wp1"
        wallPostStatus="accepted"
        isWallOwner={true}
      />
    );

    expect(screen.queryByTestId("wall-post-accept-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("wall-post-hide-btn")).toBeInTheDocument();
    expect(screen.getByTestId("wall-post-delete-btn")).toBeInTheDocument();
  });
});
