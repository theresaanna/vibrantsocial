import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentSection } from "@/components/comment-section";
import type { CommentData } from "@/hooks/use-comments";

const mockSetComments = vi.fn();

vi.mock("@/hooks/use-comments", () => ({
  useComments: (_postId: string, initial: CommentData[]) => ({
    comments: initial,
    setComments: mockSetComments,
  }),
}));

vi.mock("@/app/feed/post-actions", () => ({
  createComment: vi.fn(),
  fetchComments: vi.fn(),
  toggleCommentReaction: vi.fn(),
  editComment: vi.fn().mockResolvedValue({ success: true, message: "Comment updated" }),
  deleteComment: vi.fn().mockResolvedValue({ success: true, message: "Comment deleted" }),
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

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const baseAuthor = {
  id: "user1",
  username: "alice",
  displayName: "Alice",
  name: "Alice",
  image: null,
  avatar: null,
};

const otherAuthor = {
  id: "user2",
  username: "bob",
  displayName: "Bob",
  name: "Bob",
  image: null,
  avatar: null,
};

const makeComment = (
  id: string,
  content: string,
  opts?: { replies?: CommentData[]; author?: typeof baseAuthor; editedAt?: Date; reactions?: { emoji: string; userIds: string[] }[] }
): CommentData => ({
  id,
  content,
  createdAt: new Date("2024-01-01"),
  author: opts?.author ?? baseAuthor,
  replies: opts?.replies,
  editedAt: opts?.editedAt,
  reactions: opts?.reactions,
});

describe("CommentSection", () => {
  it("renders comments with id attributes", () => {
    const { container } = render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "First comment")]}
        phoneVerified={true}
      />
    );
    expect(container.querySelector("#comment-c1")).toBeInTheDocument();
  });

  it("renders reply comments with id attributes", () => {
    const { container } = render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Parent comment", {
            replies: [makeComment("c2", "Reply comment")],
          }),
        ]}
        phoneVerified={true}
      />
    );
    expect(container.querySelector("#comment-c1")).toBeInTheDocument();
    expect(container.querySelector("#comment-c2")).toBeInTheDocument();
  });

  it("highlights the comment matching highlightCommentId", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Normal comment"),
          makeComment("c2", "Highlighted comment"),
        ]}
        phoneVerified={true}
        highlightCommentId="c2"
      />
    );
    const highlightedComment = screen.getByText("Highlighted comment").closest(".flex.gap-2");
    expect(highlightedComment?.className).toContain("bg-blue-50");
  });

  it("does not highlight comments when highlightCommentId is null", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Normal comment")]}
        phoneVerified={true}
        highlightCommentId={null}
      />
    );
    const comment = screen.getByText("Normal comment").closest(".flex.gap-2");
    expect(comment?.className).not.toContain("bg-blue-50");
  });

  it("highlights a reply comment", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Parent", {
            replies: [makeComment("r1", "Highlighted reply")],
          }),
        ]}
        phoneVerified={true}
        highlightCommentId="r1"
      />
    );
    const reply = screen.getByText("Highlighted reply").closest(".flex.gap-2");
    expect(reply?.className).toContain("bg-blue-50");
  });

  it("scrolls to highlighted comment on mount", async () => {
    vi.useFakeTimers();
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Target comment")]}
        phoneVerified={true}
        highlightCommentId="c1"
      />
    );
    vi.advanceTimersByTime(150);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows comment input when phone is verified", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={true}
      />
    );
    expect(
      screen.getByPlaceholderText("Write a comment...")
    ).toBeInTheDocument();
  });

  it("shows verify phone prompt when not verified", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={false}
      />
    );
    expect(screen.getByText("Verify your phone")).toBeInTheDocument();
  });

  it("renders comment content", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Hello world")]}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows sign-in prompt when not authenticated", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={false}
        isAuthenticated={false}
      />
    );
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders nested replies indented", () => {
    const { container } = render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Parent", {
            replies: [makeComment("r1", "Nested reply")],
          }),
        ]}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("Nested reply")).toBeInTheDocument();
    // Reply should be inside a border-l container
    const replyContainer = container.querySelector(".border-l-2");
    expect(replyContainer).toBeInTheDocument();
  });

  it("shows (edited) indicator for edited comments", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Edited content", { editedAt: new Date("2024-01-02") }),
        ]}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("does not show (edited) for non-edited comments", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Regular comment")]}
        phoneVerified={true}
      />
    );
    expect(screen.queryByText("(edited)")).not.toBeInTheDocument();
  });

  it("shows edit/delete buttons only for comment author", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "My comment", { author: baseAuthor }),
          makeComment("c2", "Their comment", { author: otherAuthor }),
        ]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    const editButtons = screen.getAllByTestId("comment-edit-button");
    const deleteButtons = screen.getAllByTestId("comment-delete-button");
    // Only one edit and one delete button should be rendered (for user1's comment)
    expect(editButtons).toHaveLength(1);
    expect(deleteButtons).toHaveLength(1);
  });

  it("does not show edit/delete buttons when not logged in", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "A comment")]}
        phoneVerified={true}
      />
    );
    expect(screen.queryByTestId("comment-edit-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-delete-button")).not.toBeInTheDocument();
  });

  it("enters edit mode when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Original content")]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    await user.click(screen.getByTestId("comment-edit-button"));
    expect(screen.getByTestId("comment-edit-input")).toBeInTheDocument();
    expect(screen.getByTestId("comment-edit-input")).toHaveValue("Original content");
  });

  it("shows delete confirmation when Delete is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "My comment")]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    await user.click(screen.getByTestId("comment-delete-button"));
    expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
    expect(screen.getByTestId("comment-delete-confirm")).toBeInTheDocument();
  });

  it("cancels delete when Cancel is clicked in confirmation", async () => {
    const user = userEvent.setup();
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "My comment")]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    await user.click(screen.getByTestId("comment-delete-button"));
    expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
    // Click the Cancel button in the confirmation
    const cancelButtons = screen.getAllByText("Cancel");
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByText("Delete this comment?")).not.toBeInTheDocument();
  });

  it("renders reaction badges", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "With reactions", {
            reactions: [
              { emoji: "👍", userIds: ["user1", "user2"] },
              { emoji: "❤️", userIds: ["user3"] },
            ],
          }),
        ]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    const badges = screen.getAllByTestId("comment-reaction-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("👍");
    expect(badges[0]).toHaveTextContent("2");
    expect(badges[1]).toHaveTextContent("❤️");
    expect(badges[1]).toHaveTextContent("1");
  });

  it("highlights reaction badge when current user has reacted", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "With my reaction", {
            reactions: [{ emoji: "👍", userIds: ["user1"] }],
          }),
        ]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    const badge = screen.getByTestId("comment-reaction-badge");
    expect(badge.className).toContain("border-blue-300");
  });

  it("does not highlight reaction badge when user has not reacted", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Not my reaction", {
            reactions: [{ emoji: "👍", userIds: ["user2"] }],
          }),
        ]}
        phoneVerified={true}
        currentUserId="user1"
      />
    );
    const badge = screen.getByTestId("comment-reaction-badge");
    expect(badge.className).not.toContain("border-blue-300");
  });

  it("renders author avatar when provided", () => {
    const authorWithAvatar = { ...baseAuthor, avatar: "https://example.com/avatar.jpg" };
    const { container } = render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Comment with avatar", { author: authorWithAvatar })]}
        phoneVerified={true}
      />
    );
    const img = container.querySelector("img[src='https://example.com/avatar.jpg']");
    expect(img).toBeInTheDocument();
  });

  it("renders author initial when no avatar", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Comment without avatar")]}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument(); // "Alice" -> "A"
  });

  it("links author username to profile", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "By alice")]}
        phoneVerified={true}
      />
    );
    const link = screen.getByText("Alice").closest("a");
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("shows Reply button when authenticated and phone verified", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Comment")]}
        phoneVerified={true}
        isAuthenticated={true}
      />
    );
    const replyButtons = screen.getAllByText("Reply");
    expect(replyButtons.length).toBeGreaterThanOrEqual(1);
  });
});
