import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepostCard } from "@/components/repost-card";

vi.mock("@/app/feed/post-actions", () => ({
  toggleLike: vi.fn().mockResolvedValue({ success: true, message: "Liked" }),
  toggleBookmark: vi.fn().mockResolvedValue({ success: true, message: "Bookmarked" }),
  toggleRepost: vi.fn().mockResolvedValue({ success: true, message: "Reposted" }),
  createQuoteRepost: vi.fn().mockResolvedValue({ success: true, message: "Quote posted" }),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

const defaultRepost = {
  id: "r1",
  content: null,
  createdAt: new Date("2026-03-06T12:00:00Z"),
  user: {
    id: "u1",
    username: "alice",
    displayName: "Alice",
    name: "Alice Smith",
    image: null,
    avatar: null,
  },
  post: {
    id: "p1",
    content: "Hello world",
    createdAt: new Date("2026-03-05T12:00:00Z"),
    editedAt: null,
    isSensitive: false,
    isNsfw: false,
    isPinned: false,
    author: {
      id: "u2",
      username: "bob",
      displayName: "Bob",
      name: "Bob Jones",
      image: null,
      avatar: null,
    },
    _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 1 },
    likes: [],
    bookmarks: [],
    reposts: [],
    comments: [],
  },
};

describe("RepostCard", () => {
  it("renders reposter name and reposted label", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} biometricVerified={false} showNsfwByDefault={false} />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("reposted")).toBeInTheDocument();
  });

  it("renders the original post content", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} biometricVerified={false} showNsfwByDefault={false} />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders quote content when present", () => {
    const repostWithQuote = {
      ...defaultRepost,
      content: "This is my commentary",
    };
    render(
      <RepostCard repost={repostWithQuote} phoneVerified={false} biometricVerified={false} showNsfwByDefault={false} />
    );
    expect(screen.getByText("This is my commentary")).toBeInTheDocument();
  });

  it("does not render quote section for simple reposts", () => {
    const { container } = render(
      <RepostCard repost={defaultRepost} phoneVerified={false} biometricVerified={false} showNsfwByDefault={false} />
    );
    // The quote box has a specific styling, ensure it's not there
    const quoteBox = container.querySelector(".mb-2.rounded-lg.border");
    expect(quoteBox).toBeNull();
  });

  it("links reposter name to their profile", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} biometricVerified={false} showNsfwByDefault={false} />
    );
    const link = screen.getByText("Alice").closest("a");
    expect(link).toHaveAttribute("href", "/alice");
  });
});
