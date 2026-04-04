import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn(),
  Prisma: { TransactionIsolationLevel: {} },
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

import { CommentSection } from "@/components/comment-section";

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
  profileFrameId: null,
};

const makeComment = (
  id: string,
  content: string,
  opts?: { imageUrl?: string; replies?: CommentData[] }
): CommentData => ({
  id,
  content,
  createdAt: new Date("2024-01-01"),
  author: baseAuthor,
  imageUrl: opts?.imageUrl,
  replies: opts?.replies,
});

describe("Comment images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays image in comment when imageUrl is present", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Check this out", { imageUrl: "https://example.com/photo.jpg" })]}
        phoneVerified={true}
      />
    );
    const img = screen.getByTestId("comment-image");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("constrains comment image to max 1000px", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Big image", { imageUrl: "https://example.com/big.jpg" })]}
        phoneVerified={true}
      />
    );
    const img = screen.getByTestId("comment-image");
    expect(img.style.maxWidth).toBe("min(1000px, 100%)");
    expect(img.style.maxHeight).toBe("1000px");
  });

  it("shows zoom-in cursor on comment image", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "", { imageUrl: "https://example.com/img.jpg" })]}
        phoneVerified={true}
      />
    );
    const img = screen.getByTestId("comment-image");
    expect(img.className).toContain("cursor-zoom-in");
  });

  it("opens overlay when clicking comment image", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Look", { imageUrl: "https://example.com/photo.jpg" })]}
        phoneVerified={true}
      />
    );
    fireEvent.click(screen.getByTestId("comment-image"));
    expect(screen.getByTestId("image-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("image-overlay-img")).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("closes overlay on backdrop click", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "", { imageUrl: "https://example.com/photo.jpg" })]}
        phoneVerified={true}
      />
    );
    fireEvent.click(screen.getByTestId("comment-image"));
    expect(screen.getByTestId("image-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("image-overlay"));
    expect(screen.queryByTestId("image-overlay")).not.toBeInTheDocument();
  });

  it("does not show image when imageUrl is null", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Text only")]}
        phoneVerified={true}
      />
    );
    expect(screen.queryByTestId("comment-image")).not.toBeInTheDocument();
  });

  it("shows both text and image when both present", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "Caption text", { imageUrl: "https://example.com/img.jpg" })]}
        phoneVerified={true}
      />
    );
    expect(screen.getByText("Caption text")).toBeInTheDocument();
    expect(screen.getByTestId("comment-image")).toBeInTheDocument();
  });

  it("shows image-only comment without text", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[makeComment("c1", "", { imageUrl: "https://example.com/img.jpg" })]}
        phoneVerified={true}
      />
    );
    expect(screen.getByTestId("comment-image")).toBeInTheDocument();
  });

  it("renders attach image button in comment form", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={true}
      />
    );
    expect(screen.getByTestId("comment-image-button")).toBeInTheDocument();
  });

  it("shows image preview after upload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://blob.example.com/uploaded.jpg" }),
    });

    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={true}
      />
    );

    const fileInput = screen.getByTestId("comment-image-input");
    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("comment-image-preview")).toBeInTheDocument();
    });

    const previewImg = screen.getByTestId("comment-image-preview").querySelector("img");
    expect(previewImg).toHaveAttribute("src", "https://blob.example.com/uploaded.jpg");
  });

  it("removes image preview when remove button is clicked", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://blob.example.com/uploaded.jpg" }),
    });

    render(
      <CommentSection
        postId="post1"
        comments={[]}
        phoneVerified={true}
      />
    );

    const fileInput = screen.getByTestId("comment-image-input");
    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("comment-image-preview")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("comment-image-remove"));
    expect(screen.queryByTestId("comment-image-preview")).not.toBeInTheDocument();
  });

  it("displays image in nested reply comments", () => {
    render(
      <CommentSection
        postId="post1"
        comments={[
          makeComment("c1", "Parent", {
            replies: [
              makeComment("r1", "Reply with image", { imageUrl: "https://example.com/reply.jpg" }),
            ],
          }),
        ]}
        phoneVerified={true}
      />
    );
    const img = screen.getByTestId("comment-image");
    expect(img).toHaveAttribute("src", "https://example.com/reply.jpg");
  });
});
