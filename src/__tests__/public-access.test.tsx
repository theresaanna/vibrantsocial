import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostActions } from "@/components/post-actions";
import { CommentSection } from "@/components/comment-section";
import { PostCard } from "@/components/post-card";
import { PostPageClient } from "@/app/post/[id]/post-page-client";
import type { CommentData } from "@/hooks/use-comments";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// ── Mocks ──────────────────────────────────────────────────────────

let mockToggleLike: ReturnType<typeof vi.fn>;
let mockToggleBookmark: ReturnType<typeof vi.fn>;
let mockToggleRepost: ReturnType<typeof vi.fn>;
let mockCreateComment: ReturnType<typeof vi.fn>;

vi.mock("@/app/feed/post-actions", () => ({
  toggleLike: (...args: unknown[]) => mockToggleLike(...args),
  toggleBookmark: (...args: unknown[]) => mockToggleBookmark(...args),
  toggleRepost: (...args: unknown[]) => mockToggleRepost(...args),
  createComment: (...args: unknown[]) => mockCreateComment(...args),
  fetchComments: vi.fn().mockResolvedValue([]),
  toggleCommentReaction: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn(),
}));

vi.mock("@/hooks/use-comments", () => ({
  useComments: (_postId: string, initial: CommentData[]) => ({
    comments: initial,
    setComments: vi.fn(),
  }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/editor/EditorContent", () => ({
  EditorContent: ({ content }: { content: string }) => (
    <div data-testid="editor-content">{content}</div>
  ),
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="mock-editor" />,
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => null,
}));


vi.mock("@/components/tag-input", () => ({
  TagInput: () => null,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom doesn't have ResizeObserver
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockToggleLike = vi.fn().mockResolvedValue({ success: true, message: "Liked" });
  mockToggleBookmark = vi.fn().mockResolvedValue({ success: true, message: "Bookmarked" });
  mockToggleRepost = vi.fn().mockResolvedValue({ success: true, message: "Reposted" });
  mockCreateComment = vi.fn().mockResolvedValue({ success: true, message: "Created" });
});

// ── Helpers ─────────────────────────────────────────────────────────

const defaultPostActionsProps = {
  postId: "p1",
  likeCount: 5,
  commentCount: 3,
  repostCount: 2,
  bookmarkCount: 1,
  isLiked: false,
  isBookmarked: false,
  isReposted: false,
  onToggleComments: vi.fn(),
};

const baseAuthor = {
  id: "author1",
  username: "alice",
  displayName: "Alice",
  name: "Alice",
  image: null,
  avatar: null,
};

const makeComment = (
  id: string,
  content: string,
  replies?: CommentData[]
): CommentData => ({
  id,
  content,
  createdAt: new Date("2024-01-01"),
  author: baseAuthor,
  replies,
});

const makePost = (overrides = {}) => ({
  id: "post1",
  content: '{"root":{"children":[{"type":"paragraph","children":[{"text":"Hello world"}]}]}}',
  createdAt: new Date("2024-01-01"),
  editedAt: null,
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  isPinned: false,
  author: baseAuthor,
  tags: [],
  _count: { comments: 3, likes: 5, bookmarks: 1, reposts: 2 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
  ...overrides,
});

// ── PostActions readOnly ────────────────────────────────────────────

describe("PostActions - readOnly mode", () => {
  it("renders like count in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("like-readonly");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("5");
  });

  it("renders bookmark count in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("bookmark-readonly");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("1");
  });

  it("renders repost count in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("repost-readonly");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("2");
  });

  it("does not render interactive like button in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    expect(screen.queryByLabelText("Like")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Unlike")).not.toBeInTheDocument();
  });

  it("does not render interactive bookmark button in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    expect(screen.queryByLabelText("Bookmark")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Unbookmark")).not.toBeInTheDocument();
  });

  it("does not render interactive repost button in read-only mode", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    expect(screen.queryByLabelText("Repost")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Unrepost")).not.toBeInTheDocument();
  });

  it("does not call toggleLike when read-only like area is clicked", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("like-readonly");
    await user.click(el);
    expect(mockToggleLike).not.toHaveBeenCalled();
  });

  it("does not call toggleBookmark when read-only bookmark area is clicked", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("bookmark-readonly");
    await user.click(el);
    expect(mockToggleBookmark).not.toHaveBeenCalled();
  });

  it("does not call toggleRepost when read-only repost area is clicked", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("repost-readonly");
    await user.click(el);
    expect(mockToggleRepost).not.toHaveBeenCalled();
  });

  it("comment toggle still works in read-only mode", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <PostActions {...defaultPostActionsProps} readOnly onToggleComments={onToggle} />
    );
    // Comment and share buttons should still be buttons in read-only mode
    const commentBtns = screen.getAllByRole("button");
    expect(commentBtns.length).toBe(2); // comment + share
    await user.click(commentBtns[0]); // comment button is first
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does not show repost dropdown in read-only mode", async () => {
    const user = userEvent.setup();
    render(<PostActions {...defaultPostActionsProps} readOnly />);
    const el = screen.getByTestId("repost-readonly");
    await user.click(el);
    expect(screen.queryByText("Repost")).not.toBeInTheDocument();
    expect(screen.queryByText("Quote Post")).not.toBeInTheDocument();
  });

  it("hides zero counts in read-only mode", () => {
    render(
      <PostActions
        {...defaultPostActionsProps}
        likeCount={0}
        bookmarkCount={0}
        repostCount={0}
        readOnly
      />
    );
    const like = screen.getByTestId("like-readonly");
    const bookmark = screen.getByTestId("bookmark-readonly");
    const repost = screen.getByTestId("repost-readonly");
    // Text content should be empty (just the svg icon, no count span)
    expect(like.textContent).toBe("");
    expect(bookmark.textContent).toBe("");
    expect(repost.textContent).toBe("");
  });

  it("renders interactive buttons when readOnly is false", () => {
    render(<PostActions {...defaultPostActionsProps} readOnly={false} />);
    expect(screen.getByLabelText("Like")).toBeInTheDocument();
    expect(screen.getByLabelText("Bookmark")).toBeInTheDocument();
    expect(screen.getByLabelText("Repost")).toBeInTheDocument();
    expect(screen.queryByTestId("like-readonly")).not.toBeInTheDocument();
  });

  it("renders interactive buttons when readOnly is undefined (default)", () => {
    render(<PostActions {...defaultPostActionsProps} />);
    expect(screen.getByLabelText("Like")).toBeInTheDocument();
    expect(screen.getByLabelText("Bookmark")).toBeInTheDocument();
    expect(screen.getByLabelText("Repost")).toBeInTheDocument();
    expect(screen.queryByTestId("like-readonly")).not.toBeInTheDocument();
  });
});

// ── CommentSection isAuthenticated ──────────────────────────────────

describe("CommentSection - isAuthenticated", () => {
  it("shows 'Sign in to comment' when not authenticated", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    expect(screen.getByTestId("sign-in-to-comment")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText(/to comment/)).toBeInTheDocument();
  });

  it("links to /login when not authenticated", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    const link = screen.getByText("Sign in");
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });

  it("does not show comment input when not authenticated", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={true}
        isAuthenticated={false}
      />
    );
    expect(screen.queryByPlaceholderText("Write a comment...")).not.toBeInTheDocument();
  });

  it("does not show 'Verify your phone' when not authenticated", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    expect(screen.queryByText("Verify your phone")).not.toBeInTheDocument();
  });

  it("renders existing comments when not authenticated", () => {
    const comments = [
      makeComment("c1", "Great post!"),
      makeComment("c2", "I agree"),
    ];
    render(
      <CommentSection
        postId="p1"
        comments={comments}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    expect(screen.getByText("Great post!")).toBeInTheDocument();
    expect(screen.getByText("I agree")).toBeInTheDocument();
  });

  it("does not show Reply buttons on comments when not authenticated", () => {
    const comments = [makeComment("c1", "Great post!")];
    render(
      <CommentSection
        postId="p1"
        comments={comments}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("does not show Reply buttons on nested replies when not authenticated", () => {
    const comments = [
      makeComment("c1", "Great post!", [
        makeComment("c2", "Thanks!"),
      ]),
    ];
    render(
      <CommentSection
        postId="p1"
        comments={comments}
        phoneVerified={true}
        isAuthenticated={false}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("defaults isAuthenticated to true (backwards compat)", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={true}
      />
    );
    // Should show the comment form, not the "Sign in" prompt
    expect(screen.getByPlaceholderText("Write a comment...")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in-to-comment")).not.toBeInTheDocument();
  });

  it("shows comment form when authenticated and phone verified", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={true}
        isAuthenticated={true}
      />
    );
    expect(screen.getByPlaceholderText("Write a comment...")).toBeInTheDocument();
  });

  it("shows 'Verify your phone' when authenticated but not phone verified", () => {
    render(
      <CommentSection
        postId="p1"
        comments={[]}
        phoneVerified={false}
        isAuthenticated={true}
      />
    );
    expect(screen.getByText("Verify your phone")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in-to-comment")).not.toBeInTheDocument();
  });

  it("shows Reply buttons on comments when authenticated and phone verified", () => {
    const comments = [makeComment("c1", "Great post!")];
    render(
      <CommentSection
        postId="p1"
        comments={comments}
        phoneVerified={true}
        isAuthenticated={true}
      />
    );
    // Both a comment "Reply" button and the form submit "Reply" button exist
    const replyButtons = screen.getAllByText("Reply");
    expect(replyButtons.length).toBeGreaterThanOrEqual(1);
    // The comment reply button is a type="button", not type="submit"
    const commentReplyBtn = replyButtons.find(
      (el) => el.closest("button")?.getAttribute("type") === "button"
    );
    expect(commentReplyBtn).toBeDefined();
  });
});

// ── PostCard auth integration ───────────────────────────────────────

describe("PostCard - public access (no currentUserId)", () => {
  it("renders post content for unauthenticated users", () => {
    render(
      <PostCard
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("does not show author menu for unauthenticated users", () => {
    render(
      <PostCard
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
  });

  it("shows read-only post actions when no currentUserId", () => {
    render(
      <PostCard
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("like-readonly")).toBeInTheDocument();
    expect(screen.getByTestId("bookmark-readonly")).toBeInTheDocument();
    expect(screen.getByTestId("repost-readonly")).toBeInTheDocument();
  });

  it("shows interactive post actions when currentUserId is provided", () => {
    render(
      <PostCard
        post={makePost()}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByLabelText("Like")).toBeInTheDocument();
    expect(screen.getByLabelText("Bookmark")).toBeInTheDocument();
    expect(screen.queryByTestId("like-readonly")).not.toBeInTheDocument();
  });

  it("shows 'Sign in to comment' in comment section for unauthenticated users", async () => {
    const user = userEvent.setup();
    render(
      <PostCard
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
        defaultShowComments
      />
    );
    expect(screen.getByTestId("sign-in-to-comment")).toBeInTheDocument();
  });

  it("does not show author menu when currentUserId is undefined even with a real author", () => {
    // currentUserId is undefined, post author is "author1" — should not match
    render(
      <PostCard
        post={makePost({ author: { ...baseAuthor, id: "author1" } })}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
  });

  it("renders author name with link to profile", () => {
    render(
      <PostCard
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders tags as links for unauthenticated users", () => {
    render(
      <PostCard
        post={makePost({ tags: [{ tag: { name: "react" } }, { tag: { name: "nextjs" } }] })}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    const tags = screen.getByTestId("post-tags");
    expect(within(tags).getByText("#react")).toBeInTheDocument();
    expect(within(tags).getByText("#nextjs")).toBeInTheDocument();
  });

  it("renders like and bookmark counts for unauthenticated users", () => {
    render(
      <PostCard
        post={makePost({ _count: { comments: 3, likes: 42, bookmarks: 7, reposts: 11 } })}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("like-readonly")).toHaveTextContent("42");
    expect(screen.getByTestId("bookmark-readonly")).toHaveTextContent("7");
    expect(screen.getByTestId("repost-readonly")).toHaveTextContent("11");
  });
});

// ── PostPageClient ──────────────────────────────────────────────────

describe("PostPageClient - public access", () => {
  it("renders post content without currentUserId", () => {
    render(
      <PostPageClient
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
        highlightCommentId={null}
      />
    );
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("shows 'Back' link to '/' for unauthenticated users", () => {
    render(
      <PostPageClient
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
        highlightCommentId={null}
      />
    );
    const link = screen.getByTestId("back-link");
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("Back");
    expect(link).not.toHaveTextContent("Back to feed");
  });

  it("shows 'Back to feed' link to '/feed' for authenticated users", () => {
    render(
      <PostPageClient
        post={makePost()}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false} showNsfwContent={false}
        highlightCommentId={null}
      />
    );
    const link = screen.getByTestId("back-link");
    expect(link).toHaveAttribute("href", "/feed");
    expect(link).toHaveTextContent("Back to feed");
  });

  it("shows read-only actions for unauthenticated users", () => {
    render(
      <PostPageClient
        post={makePost()}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false} showNsfwContent={false}
        highlightCommentId={null}
      />
    );
    expect(screen.getByTestId("like-readonly")).toBeInTheDocument();
  });

  it("shows interactive actions for authenticated users", () => {
    render(
      <PostPageClient
        post={makePost()}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false} showNsfwContent={false}
        highlightCommentId={null}
      />
    );
    expect(screen.getByLabelText("Like")).toBeInTheDocument();
    expect(screen.queryByTestId("like-readonly")).not.toBeInTheDocument();
  });
});
