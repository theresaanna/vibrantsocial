import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentSection } from "@/components/comment-section";
import type { CommentData } from "@/hooks/use-comments";

vi.mock("@/hooks/use-comments", () => ({
  useComments: (_postId: string, initial: CommentData[]) => ({
    comments: initial,
  }),
}));

vi.mock("@/app/feed/post-actions", () => ({
  createComment: vi.fn(),
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
          makeComment("c1", "Parent comment", [
            makeComment("c2", "Reply comment"),
          ]),
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
    // The highlighted comment should have a blue background
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
          makeComment("c1", "Parent", [
            makeComment("r1", "Highlighted reply"),
          ]),
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
});
