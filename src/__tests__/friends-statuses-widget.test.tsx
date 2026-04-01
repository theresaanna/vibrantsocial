import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { FriendsStatusesWidget } from "@/components/friends-statuses-widget";

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

vi.mock("@/components/styled-name", () => ({
  StyledName: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "2m ago",
}));

let capturedOnStatusCreated: ((status: unknown) => void) | undefined;
vi.mock("@/components/status-composer", () => ({
  StatusComposer: ({ onStatusCreated }: { onStatusCreated?: (s: unknown) => void }) => {
    capturedOnStatusCreated = onStatusCreated;
    return <div data-testid="status-composer">composer</div>;
  },
}));

vi.mock("@/app/feed/status-actions", () => ({
  pollStatuses: vi.fn().mockResolvedValue({ ownStatus: null, friendStatuses: [] }),
  toggleStatusLike: vi.fn().mockResolvedValue({ success: true, message: "Liked" }),
}));

vi.mock("@/components/status-like-button", () => ({
  StatusLikeButton: ({ likeCount }: { likeCount: number }) => (
    <span data-testid="status-like-btn">{likeCount}</span>
  ),
}));

function makeStatus(id: string, username: string, content: string, userId?: string) {
  return {
    id,
    content,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    isLiked: false,
    user: {
      id: userId ?? `uid-${username}`,
      username,
      displayName: username,
      name: null,
      avatar: null,
      image: null,
      profileFrameId: null,
      usernameFont: null,
    },
  };
}

describe("FriendsStatusesWidget", () => {
  beforeEach(() => {
    capturedOnStatusCreated = undefined;
  });

  it("renders composer and empty message when no statuses", () => {
    render(<FriendsStatusesWidget statuses={[]} />);

    expect(screen.getByTestId("status-composer")).toBeDefined();
    expect(screen.getByText(/No friend statuses yet/)).toBeDefined();
  });

  it("renders status content and user names", () => {
    const statuses = [
      makeStatus("s1", "alice", "Feeling great!"),
      makeStatus("s2", "bob", "Working hard"),
    ];

    render(<FriendsStatusesWidget statuses={statuses} />);

    expect(screen.getByText("Feeling great!")).toBeDefined();
    expect(screen.getByText("Working hard")).toBeDefined();
    expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("bob").length).toBeGreaterThan(0);
  });

  it("shows View all link pointing to /statuses", () => {
    const statuses = [makeStatus("s1", "alice", "Hi")];

    render(<FriendsStatusesWidget statuses={statuses} />);

    const link = screen.getByTestId("view-all-statuses");
    expect(link.getAttribute("href")).toBe("/statuses");
  });

  it("renders all statuses in scrollable container", () => {
    const statuses = [
      makeStatus("s1", "alice", "Status 1"),
      makeStatus("s2", "bob", "Status 2"),
      makeStatus("s3", "carol", "Status 3"),
      makeStatus("s4", "dave", "Status 4"),
    ];

    render(<FriendsStatusesWidget statuses={statuses} />);

    // All statuses rendered (horizontally scrollable, all in DOM)
    expect(screen.getByText("Status 1")).toBeDefined();
    expect(screen.getByText("Status 2")).toBeDefined();
    expect(screen.getByText("Status 3")).toBeDefined();
    expect(screen.getByText("Status 4")).toBeDefined();
  });

  it("pins own status first in the scroll container", () => {
    const friendStatuses = [
      makeStatus("s1", "alice", "Friend 1"),
      makeStatus("s2", "bob", "Friend 2"),
    ];
    const ownStatus = makeStatus("own1", "me", "My status", "current-user");

    render(
      <FriendsStatusesWidget
        statuses={friendStatuses}
        currentUserId="current-user"
        initialOwnStatus={ownStatus}
      />
    );

    const container = screen.getByTestId("status-scroll-container");
    const cards = container.children;

    // Own status is the first card
    expect(cards[0].textContent).toContain("My status");
    expect(cards[1].textContent).toContain("Friend 1");
    expect(cards[2].textContent).toContain("Friend 2");
  });

  it("shows own status immediately after posting via composer", () => {
    const friendStatuses = [makeStatus("s1", "alice", "Friend status")];

    render(
      <FriendsStatusesWidget statuses={friendStatuses} currentUserId="me" />
    );

    expect(screen.getByText("Friend status")).toBeDefined();

    act(() => {
      capturedOnStatusCreated?.(makeStatus("own1", "me", "Just posted!", "me"));
    });

    const ownEl = screen.getByText("Just posted!");
    expect(ownEl).toBeDefined();
    expect(ownEl.className).toContain("font-bold");
  });

  it("bolds own statuses", () => {
    const statuses = [
      makeStatus("s1", "me", "My status", "current-user"),
      makeStatus("s2", "alice", "Friend status"),
    ];

    render(
      <FriendsStatusesWidget statuses={statuses} currentUserId="current-user" />
    );

    const ownStatus = screen.getByText("My status");
    expect(ownStatus.className).toContain("font-bold");

    const friendStatus = screen.getByText("Friend status");
    expect(friendStatus.className).not.toContain("font-bold");
  });
});
