import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/components/quote-post-modal", () => ({
  QuotePostModal: () => <div data-testid="quote-modal" />,
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

describe("PostCard - tag display", () => {
  it("renders tag chips when tags are present", () => {
    const postWithTags = {
      ...basePost,
      tags: [
        { tag: { name: "react" } },
        { tag: { name: "typescript" } },
      ],
    };

    render(
      <PostCard
        post={postWithTags}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );

    expect(screen.getByTestId("post-tags")).toBeInTheDocument();
    expect(screen.getByText("#react")).toBeInTheDocument();
    expect(screen.getByText("#typescript")).toBeInTheDocument();
  });

  it("tag chips link to /tag/{name}", () => {
    const postWithTags = {
      ...basePost,
      tags: [{ tag: { name: "react" } }],
    };

    render(
      <PostCard
        post={postWithTags}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );

    const tagLink = screen.getByText("#react").closest("a");
    expect(tagLink).toHaveAttribute("href", "/tag/react");
  });

  it("does not render tags section when tags array is empty", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );

    expect(screen.queryByTestId("post-tags")).not.toBeInTheDocument();
  });

  it("does not render tags section when tags is undefined", () => {
    const postWithoutTags = { ...basePost };
    delete (postWithoutTags as Record<string, unknown>).tags;

    render(
      <PostCard
        post={postWithoutTags}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );

    expect(screen.queryByTestId("post-tags")).not.toBeInTheDocument();
  });
});
