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
    vi.useFakeTimers();
    capturedOnStatusCreated = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("cycles through friend statuses after interval", () => {
    const statuses = [
      makeStatus("s1", "alice", "Status 1"),
      makeStatus("s2", "bob", "Status 2"),
      makeStatus("s3", "carol", "Status 3"),
      makeStatus("s4", "dave", "Status 4"),
    ];

    Object.defineProperty(document, "hidden", { value: false, configurable: true });

    render(<FriendsStatusesWidget statuses={statuses} />);

    // Initially shows first 2
    expect(screen.getByText("Status 1")).toBeDefined();
    expect(screen.getByText("Status 2")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    // Now shows next 2
    expect(screen.getByText("Status 3")).toBeDefined();
    expect(screen.getByText("Status 4")).toBeDefined();
  });

  it("does not cycle when document is hidden", () => {
    const statuses = [
      makeStatus("s1", "alice", "Status 1"),
      makeStatus("s2", "bob", "Status 2"),
      makeStatus("s3", "carol", "Status 3"),
    ];

    Object.defineProperty(document, "hidden", { value: true, configurable: true });

    render(<FriendsStatusesWidget statuses={statuses} />);

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByText("Status 1")).toBeDefined();
    expect(screen.getByText("Status 2")).toBeDefined();
  });

  it("pins own status at the top and shows one rotating friend status", () => {
    const friendStatuses = [
      makeStatus("s1", "alice", "Friend 1"),
      makeStatus("s2", "bob", "Friend 2"),
      makeStatus("s3", "carol", "Friend 3"),
    ];
    const ownStatus = makeStatus("own1", "me", "My status", "current-user");

    Object.defineProperty(document, "hidden", { value: false, configurable: true });

    render(
      <FriendsStatusesWidget
        statuses={friendStatuses}
        currentUserId="current-user"
        initialOwnStatus={ownStatus}
      />
    );

    // Own status always visible
    expect(screen.getByText("My status")).toBeDefined();
    // First friend status visible
    expect(screen.getByText("Friend 1")).toBeDefined();

    // After rotation, own status still pinned, friend rotated
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByText("My status")).toBeDefined();
    expect(screen.getByText("Friend 2")).toBeDefined();
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

    // Own status appears immediately and is bold
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
