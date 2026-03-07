import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/post-actions", () => ({
  PostActions: ({ onToggleComments }: { onToggleComments: () => void }) => (
    <div data-testid="post-actions">
      <button onClick={onToggleComments} data-testid="toggle-comments">
        comments
      </button>
    </div>
  ),
}));

vi.mock("@/components/comment-section", () => ({
  CommentSection: ({
    highlightCommentId,
  }: {
    highlightCommentId?: string | null;
  }) => (
    <div data-testid="comment-section" data-highlight={highlightCommentId ?? ""}>
      comments
    </div>
  ),
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => <div data-testid="post-revision-history" />,
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
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
};

describe("PostCard - comment display", () => {
  it("does not show comments by default", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();
  });

  it("shows comments when defaultShowComments is true", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
        defaultShowComments
      />
    );
    expect(screen.getByTestId("comment-section")).toBeInTheDocument();
  });

  it("passes highlightCommentId to CommentSection", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
        defaultShowComments
        highlightCommentId="comment123"
      />
    );
    const commentSection = screen.getByTestId("comment-section");
    expect(commentSection).toHaveAttribute("data-highlight", "comment123");
  });

  it("toggles comments visibility when toggled", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-comments"));
    expect(screen.getByTestId("comment-section")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-comments"));
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();
  });

  it("can hide comments that were shown by default", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
        defaultShowComments
      />
    );
    expect(screen.getByTestId("comment-section")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-comments"));
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();
  });
});
