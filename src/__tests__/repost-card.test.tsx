import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepostCard } from "@/components/repost-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/anthropic", () => ({
  anthropic: {},
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/app/feed/post-actions", () => ({
  toggleLike: vi.fn().mockResolvedValue({ success: true, message: "Liked" }),
  toggleBookmark: vi.fn().mockResolvedValue({ success: true, message: "Bookmarked" }),
  toggleRepost: vi.fn().mockResolvedValue({ success: true, message: "Reposted" }),
  createQuoteRepost: vi.fn().mockResolvedValue({ success: true, message: "Quote posted" }),
  editRepost: vi.fn().mockResolvedValue({ success: true, message: "Quote updated" }),
  deleteRepost: vi.fn().mockResolvedValue({ success: true, message: "Quote deleted" }),
  togglePinRepost: vi.fn().mockResolvedValue({ success: true, message: "Quote pinned" }),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const defaultRepost = {
  id: "r1",
  content: null,
  createdAt: new Date("2026-03-06T12:00:00Z"),
  editedAt: null,
  isPinned: false,
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  tags: [],
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
    isGraphicNudity: false,
    isPinned: false,
    author: {
      id: "u2",
      username: "bob",
      displayName: "Bob",
      name: "Bob Jones",
      image: null,
      avatar: null,
    },
    tags: [],
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
      <RepostCard repost={defaultRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("reposted")).toBeInTheDocument();
  });

  it("shows repost-header testid for simple reposts", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByTestId("repost-header")).toBeInTheDocument();
    expect(screen.queryByTestId("quote-header")).toBeNull();
  });

  it("shows quote-header testid for quote posts", () => {
    const quoteRepost = { ...defaultRepost, content: "My thoughts" };
    render(
      <RepostCard repost={quoteRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByTestId("quote-header")).toBeInTheDocument();
    expect(screen.queryByTestId("repost-header")).toBeNull();
  });

  it("renders the original post content", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders quote content when present", () => {
    const repostWithQuote = {
      ...defaultRepost,
      content: "This is my commentary",
    };
    render(
      <RepostCard repost={repostWithQuote} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByText("This is my commentary")).toBeInTheDocument();
  });

  it("does not render quote section for simple reposts", () => {
    const { container } = render(
      <RepostCard repost={defaultRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    // The quote box has a specific styling, ensure it's not there
    const quoteBox = container.querySelector(".mb-2.rounded-lg.border");
    expect(quoteBox).toBeNull();
  });

  it("links reposter name to their profile", () => {
    render(
      <RepostCard repost={defaultRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    const link = screen.getByText("Alice").closest("a");
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("shows menu button for quote post author", () => {
    const repostWithQuote = {
      ...defaultRepost,
      content: "My commentary",
    };
    render(
      <RepostCard repost={repostWithQuote} currentUserId="u1" phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByTestId("repost-menu-button")).toBeInTheDocument();
  });

  it("does not show menu button for non-author", () => {
    const repostWithQuote = {
      ...defaultRepost,
      content: "My commentary",
    };
    render(
      <RepostCard repost={repostWithQuote} currentUserId="u99" phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.queryByTestId("repost-menu-button")).toBeNull();
  });

  it("does not show menu button for simple reposts", () => {
    render(
      <RepostCard repost={defaultRepost} currentUserId="u1" phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.queryByTestId("repost-menu-button")).toBeNull();
  });

  it("shows pinned indicator when repost is pinned", () => {
    const pinnedRepost = {
      ...defaultRepost,
      content: "Pinned quote",
      isPinned: true,
    };
    render(
      <RepostCard repost={pinnedRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} showPinnedIndicator />
    );
    expect(screen.getByTestId("repost-pinned-indicator")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("shows edited indicator when repost was edited", () => {
    const editedRepost = {
      ...defaultRepost,
      content: "Edited quote",
      editedAt: new Date("2026-03-07T12:00:00Z"),
    };
    render(
      <RepostCard repost={editedRepost} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("displays tags on quote posts", () => {
    const repostWithTags = {
      ...defaultRepost,
      content: "Tagged quote",
      tags: [{ tag: { name: "art" } }, { tag: { name: "music" } }],
    };
    render(
      <RepostCard repost={repostWithTags} phoneVerified={false} ageVerified={false} showGraphicByDefault={false} showNsfwContent={false} hideSensitiveOverlay={false} />
    );
    expect(screen.getByText("#art")).toBeInTheDocument();
    expect(screen.getByText("#music")).toBeInTheDocument();
  });
});
