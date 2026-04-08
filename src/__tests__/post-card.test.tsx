import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---- Mock all heavy dependencies ----

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    // Return a placeholder for dynamically imported components
    const Component = (props: Record<string, unknown>) => (
      <div data-testid="dynamic-component" {...props} />
    );
    Component.displayName = "DynamicComponent";
    return Component;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn().mockResolvedValue({ success: false, message: "" }),
  deletePost: vi.fn().mockResolvedValue({ success: false, message: "" }),
  updatePostChecklist: vi.fn().mockResolvedValue({ success: false, message: "" }),
  togglePinPost: vi.fn().mockResolvedValue({ success: false, message: "" }),
}));

vi.mock("@/app/feed/comment-subscription-actions", () => ({
  toggleCommentSubscription: vi.fn().mockResolvedValue({ success: false, message: "" }),
  toggleCommentSubscriptionEmail: vi.fn().mockResolvedValue({ success: false, message: "" }),
}));

vi.mock("@/app/feed/wall-post-actions", () => ({
  updateWallPostStatus: vi.fn(),
  deleteWallPost: vi.fn(),
}));

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

vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  clearDraft: vi.fn(),
}));

vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock("@/components/auto-tag-button", () => ({
  AutoTagButton: () => <div data-testid="auto-tag-button" />,
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "5m ago",
}));

vi.mock("@/hooks/use-comment-counts", () => ({
  useCommentCount: (postId: string, initial: number) => [initial, vi.fn()],
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ initial }: { initial: string }) => (
    <div data-testid="framed-avatar">{initial}</div>
  ),
}));

vi.mock("@/components/styled-name", () => ({
  StyledName: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/marketplace-qa", () => ({
  MarketplaceQA: () => <div data-testid="marketplace-qa" />,
}));

import { PostCard } from "@/components/post-card";

interface PostOverrides {
  [key: string]: unknown;
}

interface CardOverrides {
  [key: string]: unknown;
}

const defaultAuthor = {
  id: "author-1",
  username: "testuser",
  displayName: "Test User",
  name: "Test",
  image: null,
  avatar: null,
  profileFrameId: null,
};

function makePost(overrides: PostOverrides = {}) {
  return {
    id: "post-1",
    slug: "test-post",
    content: '{"root":{"children":[]}}',
    createdAt: new Date("2026-04-01"),
    editedAt: null,
    isSensitive: false,
    isNsfw: false,
    isGraphicNudity: false,
    isCloseFriendsOnly: false,
    hasCustomAudience: false,
    isLoggedInOnly: false,
    isPinned: false,
    isAuthorDeleted: false,
    hideLinkPreview: false,
    author: defaultAuthor,
    tags: [],
    _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
    likes: [],
    bookmarks: [],
    reposts: [],
    comments: [],
    ...overrides,
  };
}

function renderCard(postOverrides: PostOverrides = {}, cardOverrides: CardOverrides = {}) {
  const defaultProps = {
    post: makePost(postOverrides),
    currentUserId: "viewer-1",
    phoneVerified: true,
    ageVerified: true,
    showGraphicByDefault: false,
    showNsfwContent: true,
    hideSensitiveOverlay: false,
    hideNsfwOverlay: false,
    ...cardOverrides,
  };
  return render(<PostCard {...defaultProps as any} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe("PostCard — basic rendering", () => {
  it("renders the post card", () => {
    renderCard();
    expect(screen.getByTestId("post-card")).toBeInTheDocument();
  });

  it("displays the author name", () => {
    renderCard();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("displays the @username", () => {
    renderCard();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("displays timestamp", () => {
    renderCard();
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("shows (edited) indicator when editedAt is set", () => {
    renderCard({ editedAt: new Date() });
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("does not show (edited) when editedAt is null", () => {
    renderCard();
    expect(screen.queryByText("(edited)")).not.toBeInTheDocument();
  });

  it("falls back to name when displayName is null", () => {
    renderCard({
      author: { ...defaultAuthor, displayName: null, name: "Fallback Name" },
    });
    expect(screen.getByText("Fallback Name")).toBeInTheDocument();
  });

  it("falls back to username when both displayName and name are null", () => {
    renderCard({
      author: { ...defaultAuthor, displayName: null, name: null },
    });
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Deleted user post
// ---------------------------------------------------------------------------

describe("PostCard — deleted user", () => {
  it("shows deleted user message for isAuthorDeleted posts", () => {
    renderCard({ isAuthorDeleted: true });
    expect(screen.getByTestId("deleted-user-post")).toBeInTheDocument();
    expect(screen.getByText(/deleted their account/)).toBeInTheDocument();
  });

  it("does not show post content for deleted user", () => {
    renderCard({ isAuthorDeleted: true });
    expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Content badges
// ---------------------------------------------------------------------------

describe("PostCard — content badges", () => {
  it("shows Sensitive badge", () => {
    renderCard({ isSensitive: true });
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  it("shows NSFW badge", () => {
    renderCard({ isNsfw: true });
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("shows Graphic/Explicit badge", () => {
    renderCard({ isGraphicNudity: true });
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("shows combined badge for multiple flags", () => {
    renderCard({ isSensitive: true, isNsfw: true });
    expect(screen.getByText("Sensitive / NSFW")).toBeInTheDocument();
  });

  it("shows no badge when no flags are set", () => {
    renderCard();
    expect(screen.queryByText("Sensitive")).not.toBeInTheDocument();
    expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Content overlays
// ---------------------------------------------------------------------------

describe("PostCard — content overlays", () => {
  it("shows age verification overlay for sensitive post when not age verified and not author", () => {
    renderCard(
      { isSensitive: true },
      { ageVerified: false, currentUserId: "viewer-1" }
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
    expect(screen.getByText("Verify your age")).toBeInTheDocument();
  });

  it("shows reveal overlay for sensitive post when age verified but overlay on", () => {
    renderCard(
      { isSensitive: true },
      { ageVerified: true, hideSensitiveOverlay: false }
    );
    expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
    expect(screen.getByText("Show content")).toBeInTheDocument();
  });

  it("shows no overlay for sensitive post when overlay is off and age verified", () => {
    renderCard(
      { isSensitive: true },
      { ageVerified: true, hideSensitiveOverlay: true }
    );
    expect(screen.queryByText(/Click to view/)).not.toBeInTheDocument();
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
  });

  it("shows NSFW overlay when hideNsfwOverlay is off", () => {
    renderCard(
      { isNsfw: true },
      { showNsfwContent: true, hideNsfwOverlay: false }
    );
    expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
  });

  it("shows no NSFW overlay when hideNsfwOverlay is on", () => {
    renderCard(
      { isNsfw: true },
      { showNsfwContent: true, hideNsfwOverlay: true }
    );
    expect(screen.queryByText(/Click to view/)).not.toBeInTheDocument();
  });

  it("shows age verification overlay for graphic content when not verified", () => {
    renderCard(
      { isGraphicNudity: true },
      { ageVerified: false }
    );
    expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
  });

  it("authors can reveal their own sensitive posts", () => {
    renderCard(
      { isSensitive: true, author: { ...defaultAuthor, id: "viewer-1" } },
      { ageVerified: false, currentUserId: "viewer-1" }
    );
    // Author should see the reveal button, not the "verify age" prompt
    expect(screen.queryByText("Verify your age to view this content.")).not.toBeInTheDocument();
  });

  it("returns null for restricted post when user is not authenticated", () => {
    const { container } = render(
      <PostCard
        post={makePost({ isSensitive: true }) as any}
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false}
        hideNsfwOverlay={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for loggedInOnly post when not authenticated", () => {
    const { container } = render(
      <PostCard
        post={makePost({ isLoggedInOnly: true }) as any}
        phoneVerified={true}
        ageVerified={false}
        showGraphicByDefault={false}
        showNsfwContent={false}
        hideSensitiveOverlay={false}
        hideNsfwOverlay={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Pinned indicator
// ---------------------------------------------------------------------------

describe("PostCard — pinned indicator", () => {
  it("shows pinned indicator when isPinned and showPinnedIndicator", () => {
    renderCard({ isPinned: true }, { showPinnedIndicator: true });
    expect(screen.getByTestId("post-pinned-indicator")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("does not show pinned indicator when showPinnedIndicator is false", () => {
    renderCard({ isPinned: true }, { showPinnedIndicator: false });
    expect(screen.queryByTestId("post-pinned-indicator")).not.toBeInTheDocument();
  });

  it("does not show pinned indicator when post is not pinned", () => {
    renderCard({ isPinned: false }, { showPinnedIndicator: true });
    expect(screen.queryByTestId("post-pinned-indicator")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wall posts
// ---------------------------------------------------------------------------

describe("PostCard — wall posts", () => {
  it("shows wall post banner when wallOwner is provided", () => {
    renderCard({}, {
      wallOwner: { username: "walluser", displayName: "Wall User" },
    });
    expect(screen.getByTestId("wall-post-banner")).toBeInTheDocument();
  });

  it("does not show wall post banner without wallOwner", () => {
    renderCard();
    expect(screen.queryByTestId("wall-post-banner")).not.toBeInTheDocument();
  });

  it("shows pending badge for pending wall posts", () => {
    renderCard({}, {
      wallOwner: { username: "walluser", displayName: "Wall User" },
      wallPostStatus: "pending",
    });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Close friends / custom audience badges
// ---------------------------------------------------------------------------

describe("PostCard — special badges", () => {
  it("shows close friends badge", () => {
    renderCard({ isCloseFriendsOnly: true });
    // Close friends badge is an SVG star, check for the title attribute
    const badge = screen.getByTitle("Close friends only");
    expect(badge).toBeInTheDocument();
  });

  it("shows custom audience badge", () => {
    renderCard({ hasCustomAudience: true });
    const badge = screen.getByTitle("Custom audience");
    expect(badge).toBeInTheDocument();
  });

  it("shows logged-in only badge", () => {
    renderCard({ isLoggedInOnly: true });
    const badge = screen.getByTitle("Logged-in users only");
    expect(badge).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Menu visibility
// ---------------------------------------------------------------------------

describe("PostCard — menu", () => {
  it("shows menu button when authenticated", () => {
    renderCard();
    expect(screen.getByTestId("post-menu-button")).toBeInTheDocument();
  });

  it("does not show menu button when not authenticated", () => {
    renderCard({}, { currentUserId: undefined });
    expect(screen.queryByTestId("post-menu-button")).not.toBeInTheDocument();
  });

  it("shows author actions (edit, delete) when user is the author", async () => {
    const user = userEvent.setup();
    renderCard(
      { author: { ...defaultAuthor, id: "viewer-1" } },
      { currentUserId: "viewer-1" }
    );

    await user.click(screen.getByTestId("post-menu-button"));

    expect(screen.getByTestId("post-edit-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-delete-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-revision-history-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-pin-button")).toBeInTheDocument();
  });

  it("shows report button for non-authors", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId("post-menu-button"));

    expect(screen.getByTestId("post-report-button")).toBeInTheDocument();
    expect(screen.queryByTestId("post-edit-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("post-delete-button")).not.toBeInTheDocument();
  });

  it("shows 'Pin to profile' for unpinned post", async () => {
    const user = userEvent.setup();
    renderCard(
      { isPinned: false, author: { ...defaultAuthor, id: "viewer-1" } },
      { currentUserId: "viewer-1" }
    );

    await user.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-pin-button")).toHaveTextContent("Pin to profile");
  });

  it("shows 'Unpin' for pinned post", async () => {
    const user = userEvent.setup();
    renderCard(
      { isPinned: true, author: { ...defaultAuthor, id: "viewer-1" } },
      { currentUserId: "viewer-1" }
    );

    await user.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-pin-button")).toHaveTextContent("Unpin");
  });

  it("shows comment subscription button in menu", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId("post-menu-button"));
    expect(screen.getByTestId("post-comment-subscribe-button")).toBeInTheDocument();
    expect(screen.getByTestId("post-comment-subscribe-button")).toHaveTextContent(
      "Subscribe to comments"
    );
  });
});
