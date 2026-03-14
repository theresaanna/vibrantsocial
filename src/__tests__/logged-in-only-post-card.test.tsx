import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/components/post-actions", () => ({
  PostActions: () => <div data-testid="post-actions" />,
}));

vi.mock("@/components/comment-section", () => ({
  CommentSection: () => <div data-testid="comment-section" />,
}));

vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => null,
}));

vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  clearDraft: vi.fn(),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
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

vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: () => null,
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "just now",
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: () => false,
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

const basePost = {
  id: "post1",
  content: "Test post content",
  createdAt: new Date("2025-01-01"),
  editedAt: null,
  isAuthorDeleted: false,
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  isCloseFriendsOnly: false,
  isLoggedInOnly: false,
  isPinned: false,
  author: {
    id: "user1",
    username: "testuser",
    displayName: "Test User",
    name: null,
    image: null,
    avatar: null,
  },
  tags: [],
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
};

describe("PostCard - Logged-in Only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows logged-in-only badge when isLoggedInOnly is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isLoggedInOnly: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByTitle("Logged-in users only")).toBeInTheDocument();
  });

  it("does not show logged-in-only badge when isLoggedInOnly is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isLoggedInOnly: false }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.queryByTitle("Logged-in users only")).not.toBeInTheDocument();
  });

  it("hides post from logged-out users when isLoggedInOnly is true", () => {
    const { container } = render(
      <PostCard
        post={{ ...basePost, isLoggedInOnly: true }}
        currentUserId={undefined}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    // PostCard returns null for logged-out users viewing logged-in-only posts
    expect(container.innerHTML).toBe("");
  });

  it("shows post to logged-in users when isLoggedInOnly is true", () => {
    render(
      <PostCard
        post={{ ...basePost, isLoggedInOnly: true }}
        currentUserId="user2"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
  });

  it("shows post to logged-out users when isLoggedInOnly is false", () => {
    render(
      <PostCard
        post={{ ...basePost, isLoggedInOnly: false }}
        currentUserId={undefined}
        phoneVerified={false}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
  });

  it("can show both close-friends and logged-in-only badges", () => {
    render(
      <PostCard
        post={{ ...basePost, isCloseFriendsOnly: true, isLoggedInOnly: true }}
        currentUserId="user1"
        phoneVerified={true}
        ageVerified={true}
        showGraphicByDefault={false}
        showNsfwContent={false}
      />
    );
    expect(screen.getByTitle("Close friends only")).toBeInTheDocument();
    expect(screen.getByTitle("Logged-in users only")).toBeInTheDocument();
  });
});
