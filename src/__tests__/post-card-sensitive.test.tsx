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

describe("PostCard - sensitive/NSFW content gating", () => {
  it("renders normal post content regardless of verification", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Verify your age to view this content.")).not.toBeInTheDocument();
  });

  it("shows locked overlay for sensitive post when not biometric verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    expect(screen.queryByText("Show content")).not.toBeInTheDocument();
  });

  it("shows locked overlay for NSFW post when not biometric verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    expect(screen.queryByText("Show content")).not.toBeInTheDocument();
  });

  it("shows click-to-reveal for sensitive post when biometric verified", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={false}
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
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view sensitive content")).not.toBeInTheDocument();
  });

  it("shows click-to-reveal for NSFW post when biometric verified and showNsfwByDefault is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });

  it("shows NSFW content by default when biometric verified and showNsfwByDefault is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={true}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
    expect(screen.queryByText("Click to view NSFW content")).not.toBeInTheDocument();
  });

  it("shows Sensitive badge on revealed sensitive post", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByText("Show content"));
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  it("shows NSFW badge on NSFW post shown by default", () => {
    render(
      <PostCard
        post={{ ...basePost, isNsfw: true }}
        phoneVerified={true}
        biometricVerified={true}
        showNsfwByDefault={true}
      />
    );
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("always shows author header even when content is hidden", () => {
    render(
      <PostCard
        post={{ ...basePost, isSensitive: true }}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });
});
