import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { FriendsStatusesWidget } from "@/components/friends-statuses-widget";

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

vi.mock("@/components/styled-name", () => ({
  StyledName: ({ displayName, username }: { displayName?: string | null; username?: string | null }) => (
    <span>{displayName || username}</span>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "2m ago",
}));

vi.mock("@/components/status-composer", () => ({
  StatusComposer: () => <div data-testid="status-composer">composer</div>,
}));

function makeStatus(id: string, username: string, content: string) {
  return {
    id,
    content,
    createdAt: new Date().toISOString(),
    user: {
      id: `uid-${username}`,
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
    expect(screen.getByText("alice")).toBeDefined();
    expect(screen.getByText("bob")).toBeDefined();
  });

  it("shows View all link pointing to /statuses", () => {
    const statuses = [makeStatus("s1", "alice", "Hi")];

    render(<FriendsStatusesWidget statuses={statuses} />);

    const link = screen.getByTestId("view-all-statuses");
    expect(link.getAttribute("href")).toBe("/statuses");
  });

  it("cycles to next statuses after interval", () => {
    const statuses = [
      makeStatus("s1", "alice", "Status 1"),
      makeStatus("s2", "bob", "Status 2"),
      makeStatus("s3", "carol", "Status 3"),
      makeStatus("s4", "dave", "Status 4"),
    ];

    // Ensure document.hidden is false so rotation fires
    Object.defineProperty(document, "hidden", { value: false, configurable: true });

    render(<FriendsStatusesWidget statuses={statuses} />);

    // Initially shows first 2
    expect(screen.getByText("Status 1")).toBeDefined();
    expect(screen.getByText("Status 2")).toBeDefined();

    // Advance timer to trigger rotation
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

    // Should still show the first 2 (didn't rotate)
    expect(screen.getByText("Status 1")).toBeDefined();
    expect(screen.getByText("Status 2")).toBeDefined();
  });
});
