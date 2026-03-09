import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
  tags: [],
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
};

describe("PostCard - pin indicator", () => {
  it("shows pinned indicator when post is pinned", () => {
    render(
      <PostCard
        post={{ ...basePost, isPinned: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("post-pinned-indicator")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("does not show pinned indicator when post is not pinned", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.queryByTestId("post-pinned-indicator")).not.toBeInTheDocument();
  });

  it("shows 'Unpin' in menu for pinned post when author is viewing", () => {
    render(
      <PostCard
        post={{ ...basePost, isPinned: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-pin-button")).toHaveTextContent("Unpin");
  });

  it("shows 'Pin to profile' in menu for unpinned post when author is viewing", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-pin-button")).toHaveTextContent("Pin to profile");
  });

  it("does not show pin button for non-authors", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="other-user"
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-pin-button")).not.toBeInTheDocument();
  });
});
