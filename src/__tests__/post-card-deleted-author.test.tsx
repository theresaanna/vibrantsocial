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

vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

import { PostCard } from "@/components/post-card";

const basePost = {
  id: "post1",
  content: "Test content",
  createdAt: new Date(),
  editedAt: null,
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

describe("PostCard - deleted author", () => {
  it("renders deleted user placeholder when isAuthorDeleted is true", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          isAuthorDeleted: true,
          author: null,
          content: '{"root":{"children":[]}}',
        }}
        {...defaultProps}
      />
    );

    expect(
      screen.getByText("This post is from a user who deleted their account")
    ).toBeInTheDocument();
    expect(screen.getByTestId("deleted-user-post")).toBeInTheDocument();
  });

  it("does not render post content when isAuthorDeleted is true", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          isAuthorDeleted: true,
          author: null,
          content: '{"root":{"children":[]}}',
        }}
        {...defaultProps}
      />
    );

    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-actions")).not.toBeInTheDocument();
  });

  it("does not render author header when isAuthorDeleted is true", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          isAuthorDeleted: true,
          author: null,
          content: '{"root":{"children":[]}}',
        }}
        {...defaultProps}
      />
    );

    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.queryByText("@testuser")).not.toBeInTheDocument();
  });

  it("renders normally when isAuthorDeleted is false", () => {
    render(<PostCard post={basePost} {...defaultProps} />);

    expect(
      screen.queryByText("This post is from a user who deleted their account")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
  });

  it("renders normally when isAuthorDeleted is undefined", () => {
    render(<PostCard post={basePost} {...defaultProps} />);

    expect(
      screen.queryByTestId("deleted-user-post")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});
