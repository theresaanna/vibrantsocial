import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/repost-card", () => ({
  RepostCard: ({
    repost,
    currentUserId,
    phoneVerified,
  }: {
    repost: { id: string; user: { displayName: string | null } };
    currentUserId?: string;
    phoneVerified: boolean;
  }) => (
    <div data-testid="repost-card">
      <span>{repost.user.displayName}</span>
      <span data-testid="repost-id">{repost.id}</span>
      {currentUserId && <span data-testid="current-user">{currentUserId}</span>}
    </div>
  ),
}));

import { QuotePageClient } from "@/app/quote/[id]/quote-page-client";

const mockUser = {
  id: "user1",
  username: "alice",
  displayName: "Alice",
  name: "Alice",
  image: null,
  avatar: null,
};

const mockRepost = {
  id: "repost-1",
  content: "My quote commentary",
  createdAt: new Date().toISOString(),
  editedAt: null,
  isPinned: false,
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  tags: [],
  user: mockUser,
  _count: { likes: 5, bookmarks: 2, comments: 3 },
  likes: [],
  bookmarks: [],
  post: {
    id: "post-1",
    content: '{"root":{}}',
    createdAt: new Date().toISOString(),
    editedAt: null,
    isAuthorDeleted: false,
    isSensitive: false,
    isNsfw: false,
    isGraphicNudity: false,
    isPinned: false,
    author: mockUser,
    tags: [],
    _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
    likes: [],
    bookmarks: [],
    reposts: [],
  },
  comments: [],
};

const defaultProps = {
  repost: mockRepost,
  currentUserId: "user1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
};

describe("QuotePageClient", () => {
  it("renders the RepostCard component", () => {
    render(<QuotePageClient {...defaultProps} />);
    expect(screen.getByTestId("repost-card")).toBeInTheDocument();
  });

  it("passes repost data to RepostCard", () => {
    render(<QuotePageClient {...defaultProps} />);
    expect(screen.getByTestId("repost-id")).toHaveTextContent("repost-1");
  });

  it("passes currentUserId to RepostCard", () => {
    render(<QuotePageClient {...defaultProps} />);
    expect(screen.getByTestId("current-user")).toHaveTextContent("user1");
  });

  it("renders repost user display name", () => {
    render(<QuotePageClient {...defaultProps} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders without currentUserId", () => {
    render(<QuotePageClient {...defaultProps} currentUserId={undefined} />);
    expect(screen.getByTestId("repost-card")).toBeInTheDocument();
    expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();
  });

  it("wraps RepostCard in a styled container", () => {
    const { container } = render(<QuotePageClient {...defaultProps} />);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass("rounded-2xl");
  });
});
