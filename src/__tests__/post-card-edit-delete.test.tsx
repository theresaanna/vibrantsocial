import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: ({
    initialContent,
    inputName,
  }: {
    initialContent?: string;
    inputName?: string;
  }) => (
    <div data-testid="mock-editor">
      {inputName && (
        <input type="hidden" name={inputName} value={initialContent ?? ""} />
      )}
    </div>
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
  CommentSection: () => <div data-testid="comment-section">comments</div>,
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: ({
    onClose,
  }: {
    onClose: () => void;
  }) => (
    <div data-testid="post-revision-history">
      <button onClick={onClose} data-testid="close-revision-history">
        Close
      </button>
    </div>
  ),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn().mockResolvedValue({ success: true, message: "Post updated" }),
  deletePost: vi.fn().mockResolvedValue({ success: true, message: "Post deleted" }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

const basePost = {
  id: "post1",
  content: "Test content",
  createdAt: new Date(),
  editedAt: null,
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

describe("PostCard - timestamp permalink", () => {
  it("renders timestamp as a link to /post/[postId]", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    const link = screen.getByText("1m ago").closest("a");
    expect(link).toHaveAttribute("href", "/post/post1");
  });
});

describe("PostCard - edited indicator", () => {
  it("shows (edited) when editedAt is set", () => {
    render(
      <PostCard
        post={{ ...basePost, editedAt: new Date() }}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("does not show (edited) when editedAt is null", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByText("(edited)")).not.toBeInTheDocument();
  });
});

describe("PostCard - author menu", () => {
  it("does not show menu button when currentUserId does not match author", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="other-user"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
  });

  it("does not show menu button when currentUserId is not provided", () => {
    render(
      <PostCard
        post={basePost}
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
  });

  it("shows menu button when currentUserId matches author", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByTestId("post-menu-button")).toBeInTheDocument();
  });

  it("toggles dropdown menu on click", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.queryByTestId("post-edit-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-edit-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-delete-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-revision-history-button")).toBeInTheDocument();
  });
});

describe("PostCard - edit mode", () => {
  it("enters edit mode when Edit is clicked", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    fireEvent.click(screen.getByTestId("post-edit-button"));

    expect(screen.getByTestId("post-edit-editor")).toBeInTheDocument();
    expect(screen.getByTestId("post-edit-save")).toBeInTheDocument();
    expect(screen.getByTestId("post-edit-cancel")).toBeInTheDocument();
  });

  it("exits edit mode when Cancel is clicked", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    fireEvent.click(screen.getByTestId("post-edit-button"));
    expect(screen.getByTestId("post-edit-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("post-edit-cancel"));
    expect(screen.queryByTestId("post-edit-editor")).not.toBeInTheDocument();
  });

  it("hides post content when editing", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("post-menu-button"));
    fireEvent.click(screen.getByTestId("post-edit-button"));
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });
});

describe("PostCard - revision history", () => {
  it("opens revision history modal when clicked", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    fireEvent.click(screen.getByTestId("post-revision-history-button"));

    expect(screen.getByTestId("post-revision-history")).toBeInTheDocument();
  });

  it("closes revision history modal", () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="user1"
        phoneVerified={true}
        biometricVerified={false}
        showNsfwByDefault={false}
      />
    );
    fireEvent.click(screen.getByTestId("post-menu-button"));
    fireEvent.click(screen.getByTestId("post-revision-history-button"));
    expect(screen.getByTestId("post-revision-history")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("close-revision-history"));
    expect(screen.queryByTestId("post-revision-history")).not.toBeInTheDocument();
  });
});
