import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepostCommentSection } from "@/components/repost-comment-section";

const mockCreateRepostComment = vi.fn();
const mockFetchRepostComments = vi.fn().mockResolvedValue([]);

vi.mock("@/app/feed/post-actions", () => ({
  createRepostComment: (...args: unknown[]) =>
    mockCreateRepostComment(...args),
  fetchRepostComments: (...args: unknown[]) =>
    mockFetchRepostComments(...args),
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

vi.mock("@/components/chat/linkify-text", () => ({
  LinkifyText: ({ text }: { text: string }) => <span>{text}</span>,
}));

const makeComment = (
  id: string,
  content: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  content,
  createdAt: new Date("2024-01-01"),
  author: {
    id: "user1",
    username: "alice",
    displayName: "Alice",
    name: "Alice",
    image: null,
    avatar: null,
  },
  ...overrides,
});

describe("RepostCommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders comments when provided", () => {
    const comments = [
      makeComment("c1", "First comment"),
      makeComment("c2", "Second comment"),
    ];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("shows loading state when comments are not provided", () => {
    render(
      <RepostCommentSection
        repostId="r1"
        phoneVerified={true}
      />
    );
    expect(screen.getByText("Loading comments...")).toBeInTheDocument();
  });

  it("shows comment input when phone is verified", () => {
    render(
      <RepostCommentSection
        repostId="r1"
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
      <RepostCommentSection
        repostId="r1"
        comments={[]}
        phoneVerified={false}
      />
    );
    expect(screen.getByText("Verify your phone")).toBeInTheDocument();
  });

  it("shows sign-in prompt when not authenticated", () => {
    render(
      <RepostCommentSection
        repostId="r1"
        comments={[]}
        phoneVerified={true}
        isAuthenticated={false}
      />
    );
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows Reply button for each comment when authenticated and phone verified", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
        isAuthenticated={true}
      />
    );
    const replyButtons = screen.getAllByText("Reply");
    // One reply button on the comment, and one submit button
    expect(replyButtons.length).toBeGreaterThanOrEqual(1);
    // At least one should be a small inline reply button (type="button")
    const inlineReply = replyButtons.find(
      (btn) => btn.getAttribute("type") === "button"
    );
    expect(inlineReply).toBeTruthy();
  });

  it("does not show Reply button when not authenticated", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
        isAuthenticated={false}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("does not show Reply button when phone is not verified", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={false}
        isAuthenticated={true}
      />
    );
    expect(screen.queryByText("Reply")).not.toBeInTheDocument();
  });

  it("renders nested replies", () => {
    const comments = [
      makeComment("c1", "Parent comment", {
        replies: [makeComment("r1", "Reply comment")],
      }),
    ];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("Parent comment")).toBeInTheDocument();
    expect(screen.getByText("Reply comment")).toBeInTheDocument();
  });

  it("shows author name with link to profile", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    const authorLink = screen.getByText("Alice").closest("a");
    expect(authorLink).toHaveAttribute("href", "/alice");
  });

  it("shows author initial when no avatar is provided", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows avatar image when avatar is provided", () => {
    const comments = [
      makeComment("c1", "A comment", {
        author: {
          id: "user1",
          username: "alice",
          displayName: "Alice",
          name: "Alice",
          image: null,
          avatar: "https://example.com/avatar.jpg",
        },
      }),
    ];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows time ago for comments", () => {
    const comments = [makeComment("c1", "A comment")];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });

  it("has a submit button labeled Reply", () => {
    render(
      <RepostCommentSection
        repostId="r1"
        comments={[]}
        phoneVerified={true}
      />
    );
    const submitButton = screen.getByRole("button", { name: "Reply" });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("renders with empty comments array", () => {
    render(
      <RepostCommentSection
        repostId="r1"
        comments={[]}
        phoneVerified={true}
      />
    );
    expect(screen.getByTestId("repost-comment-section")).toBeInTheDocument();
  });

  it("shows author name without link when username is null", () => {
    const comments = [
      makeComment("c1", "A comment", {
        author: {
          id: "user1",
          username: null,
          displayName: "Alice",
          name: "Alice",
          image: null,
          avatar: null,
        },
      }),
    ];
    render(
      <RepostCommentSection
        repostId="r1"
        comments={comments}
        phoneVerified={true}
      />
    );
    const authorText = screen.getByText("Alice");
    expect(authorText.closest("a")).toBeNull();
  });
});
