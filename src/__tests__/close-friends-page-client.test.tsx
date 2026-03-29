import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string } }) => (
    <div data-testid={`post-card-${post.id}`}>Post {post.id}</div>
  ),
}));

vi.mock("@/components/repost-card", () => ({
  RepostCard: ({ repost }: { repost: { id: string } }) => (
    <div data-testid={`repost-card-${repost.id}`}>Repost {repost.id}</div>
  ),
}));

vi.mock("@/app/feed/close-friends-actions", () => ({
  addCloseFriend: vi.fn(),
  removeCloseFriend: vi.fn(),
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

// Mock useActionState
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: (
      _action: unknown,
      initialState: unknown
    ) => {
      const [, setTriggered] = (actual as typeof import("react")).useState(false);
      const formAction = () => setTriggered(true);
      return [initialState, formAction, false];
    },
  };
});

import { CloseFriendsPageClient } from "@/app/close-friends/close-friends-page-client";

const makeFriend = (id: string, username: string, displayName: string | null = null) => ({
  id,
  username,
  displayName,
  name: displayName,
  avatar: null,
  image: null,
  profileFrameId: null,
  usernameFont: null,
});

const defaultProps = {
  initialItems: [] as Array<{ type: "post" | "repost"; data: { id: string }; date: string }>,
  initialHasMore: false,
  currentUserId: "user1",
  phoneVerified: true,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
  closeFriends: [
    {
      id: "cf1",
      friendId: "f1",
      friend: makeFriend("f1", "alice", "Alice"),
    },
  ],
  availableFriends: [makeFriend("f2", "bob", "Bob")],
};

describe("CloseFriendsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── Page header ──────────────────────────────────────────

  it("renders Close Friends heading", () => {
    render(<CloseFriendsPageClient {...defaultProps} />);
    expect(screen.getByText("Close Friends")).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<CloseFriendsPageClient {...defaultProps} />);
    expect(
      screen.getByText("Posts from your close friends")
    ).toBeInTheDocument();
  });

  // ─── Tab rendering ─────────────────────────────────────────

  it("renders Feed and Manage List tabs", () => {
    render(<CloseFriendsPageClient {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /^feed$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage list/i })
    ).toBeInTheDocument();
  });

  it("shows feed tab by default", () => {
    render(<CloseFriendsPageClient {...defaultProps} />);
    // Feed tab has the active styling
    const feedTab = screen.getByRole("button", { name: /^feed$/i });
    expect(feedTab.className).toContain("bg-white");
  });

  // ─── Feed tab content ──────────────────────────────────────

  it("shows empty feed message when no items and has close friends", () => {
    render(<CloseFriendsPageClient {...defaultProps} />);
    expect(
      screen.getByText("No posts from your close friends yet.")
    ).toBeInTheDocument();
  });

  it("shows no close friends message when closeFriends count is 0", () => {
    render(
      <CloseFriendsPageClient
        {...defaultProps}
        closeFriends={[]}
      />
    );
    expect(
      screen.getByText("No close friends yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/switch to "manage list"/i)
    ).toBeInTheDocument();
  });

  it("renders post cards in the feed", () => {
    const items = [
      {
        type: "post" as const,
        data: { id: "p1" },
        date: new Date().toISOString(),
      },
    ];
    render(
      <CloseFriendsPageClient {...defaultProps} initialItems={items} />
    );
    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
  });

  it("renders repost cards in the feed", () => {
    const items = [
      {
        type: "repost" as const,
        data: { id: "r1" },
        date: new Date().toISOString(),
      },
    ];
    render(
      <CloseFriendsPageClient {...defaultProps} initialItems={items} />
    );
    expect(screen.getByTestId("repost-card-r1")).toBeInTheDocument();
  });

  // ─── Manage List tab ──────────────────────────────────────

  it("switches to manage list tab", async () => {
    const user = userEvent.setup();
    render(<CloseFriendsPageClient {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /manage list/i }));

    // Should show the CloseFriendsClient content
    expect(
      screen.getByText(/only you can see this list/i)
    ).toBeInTheDocument();
  });

  it("shows close friends in manage tab", async () => {
    const user = userEvent.setup();
    render(<CloseFriendsPageClient {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /manage list/i }));

    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows available friends in manage tab", async () => {
    const user = userEvent.setup();
    render(<CloseFriendsPageClient {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /manage list/i }));

    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("can switch back to feed tab", async () => {
    const user = userEvent.setup();
    render(<CloseFriendsPageClient {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /manage list/i }));
    expect(
      screen.getByText(/only you can see this list/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^feed$/i }));
    expect(
      screen.queryByText(/only you can see this list/i)
    ).not.toBeInTheDocument();
  });
});
