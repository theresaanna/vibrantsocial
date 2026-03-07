import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUpdatePostChecklist } = vi.hoisted(() => ({
  mockUpdatePostChecklist: vi.fn(),
}));

vi.mock("@/components/post-content", () => ({
  PostContent: ({
    content,
    allowChecklistToggle,
    onContentChange,
  }: {
    content: string;
    truncate?: boolean;
    allowChecklistToggle?: boolean;
    onContentChange?: (json: string) => void;
  }) => (
    <div
      data-testid="post-content"
      data-allow-checklist={allowChecklistToggle ? "true" : "false"}
      data-has-onchange={onContentChange ? "true" : "false"}
    >
      {content}
      {onContentChange && (
        <button
          data-testid="simulate-toggle"
          onClick={() => onContentChange('{"toggled":true}')}
        >
          toggle
        </button>
      )}
    </div>
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

vi.mock("@/components/quote-post-modal", () => ({
  QuotePostModal: () => <div data-testid="quote-modal" />,
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
  deletePost: vi.fn().mockResolvedValue({ success: true, message: "" }),
  updatePostChecklist: mockUpdatePostChecklist,
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

describe("PostCard - checklist toggle", () => {
  it("passes allowChecklistToggle=true when user is author", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const postContent = screen.getByTestId("post-content");
    expect(postContent.dataset.allowChecklist).toBe("true");
  });

  it("passes allowChecklistToggle=false when user is not author", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="other-user"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const postContent = screen.getByTestId("post-content");
    expect(postContent.dataset.allowChecklist).toBe("false");
  });

  it("passes allowChecklistToggle=false when no currentUserId", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const postContent = screen.getByTestId("post-content");
    expect(postContent.dataset.allowChecklist).toBe("false");
  });

  it("provides onContentChange callback when user is author", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const postContent = screen.getByTestId("post-content");
    expect(postContent.dataset.hasOnchange).toBe("true");
  });

  it("calls updatePostChecklist when checklist is toggled", () => {
    mockUpdatePostChecklist.mockClear();
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const toggleBtn = screen.getByTestId("simulate-toggle");
    toggleBtn.click();

    expect(mockUpdatePostChecklist).toHaveBeenCalledWith(
      "post1",
      '{"toggled":true}'
    );
  });
});
