import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserList } from "@/components/user-list";
import type { FollowUser } from "@/app/feed/follow-actions";
import type { UserFriendshipInfo } from "@/components/user-list";

vi.mock("@/components/follow-button", () => ({
  FollowButton: ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => (
    <button data-testid={`follow-btn-${userId}`}>
      {isFollowing ? "Unfollow" : "Follow"}
    </button>
  ),
}));

vi.mock("@/components/friend-button", () => ({
  FriendButton: ({
    userId,
    friendshipStatus,
    requestId,
  }: {
    userId: string;
    friendshipStatus: string;
    requestId?: string;
  }) => (
    <button data-testid={`friend-btn-${userId}`} data-status={friendshipStatus} data-request-id={requestId}>
      {friendshipStatus === "none"
        ? "Add Friend"
        : friendshipStatus === "pending_sent"
          ? "Pending"
          : friendshipStatus === "pending_received"
            ? "Accept"
            : "Friends"}
    </button>
  ),
}));

const makeUser = (id: string, username: string, isFollowing = false): FollowUser => ({
  id,
  username,
  displayName: username.charAt(0).toUpperCase() + username.slice(1),
  name: null,
  avatar: null,
  image: null,
  profileFrameId: null,
  isFollowing,
});

describe("UserList with friendshipStatuses", () => {
  // ─── Backwards compatibility ──────────────────────────────

  it("only renders FollowButton when friendshipStatuses is not provided", () => {
    const users = [makeUser("u1", "alice"), makeUser("u2", "bob")];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    expect(screen.getByTestId("follow-btn-u1")).toBeInTheDocument();
    expect(screen.getByTestId("follow-btn-u2")).toBeInTheDocument();
    expect(screen.queryByTestId("friend-btn-u1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friend-btn-u2")).not.toBeInTheDocument();
  });

  // ─── With friendshipStatuses ──────────────────────────────

  it("renders both FollowButton and FriendButton when friendshipStatuses is provided", () => {
    const users = [makeUser("u1", "alice"), makeUser("u2", "bob")];
    const friendshipStatuses: Record<string, UserFriendshipInfo> = {
      u1: { status: "none" },
      u2: { status: "friends" },
    };
    render(
      <UserList
        users={users}
        currentUserId="me"
        emptyMessage="Empty"
        friendshipStatuses={friendshipStatuses}
      />
    );
    // Both follow buttons
    expect(screen.getByTestId("follow-btn-u1")).toBeInTheDocument();
    expect(screen.getByTestId("follow-btn-u2")).toBeInTheDocument();
    // Both friend buttons
    expect(screen.getByTestId("friend-btn-u1")).toBeInTheDocument();
    expect(screen.getByTestId("friend-btn-u2")).toBeInTheDocument();
  });

  it("shows correct friendship status per user", () => {
    const users = [
      makeUser("u1", "alice"),
      makeUser("u2", "bob"),
      makeUser("u3", "carol"),
      makeUser("u4", "dave"),
    ];
    const friendshipStatuses: Record<string, UserFriendshipInfo> = {
      u1: { status: "none" },
      u2: { status: "pending_sent" },
      u3: { status: "pending_received", requestId: "req123" },
      u4: { status: "friends" },
    };
    render(
      <UserList
        users={users}
        currentUserId="me"
        emptyMessage="Empty"
        friendshipStatuses={friendshipStatuses}
      />
    );
    expect(screen.getByTestId("friend-btn-u1")).toHaveAttribute("data-status", "none");
    expect(screen.getByTestId("friend-btn-u2")).toHaveAttribute("data-status", "pending_sent");
    expect(screen.getByTestId("friend-btn-u3")).toHaveAttribute("data-status", "pending_received");
    expect(screen.getByTestId("friend-btn-u3")).toHaveAttribute("data-request-id", "req123");
    expect(screen.getByTestId("friend-btn-u4")).toHaveAttribute("data-status", "friends");
  });

  it("does not show buttons for the current user even with friendshipStatuses", () => {
    const users = [makeUser("me", "myself"), makeUser("u2", "bob")];
    const friendshipStatuses: Record<string, UserFriendshipInfo> = {
      me: { status: "friends" },
      u2: { status: "none" },
    };
    render(
      <UserList
        users={users}
        currentUserId="me"
        emptyMessage="Empty"
        friendshipStatuses={friendshipStatuses}
      />
    );
    expect(screen.queryByTestId("follow-btn-me")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friend-btn-me")).not.toBeInTheDocument();
    expect(screen.getByTestId("follow-btn-u2")).toBeInTheDocument();
    expect(screen.getByTestId("friend-btn-u2")).toBeInTheDocument();
  });

  it("does not render FriendButton for users not in friendshipStatuses map", () => {
    const users = [makeUser("u1", "alice"), makeUser("u2", "bob")];
    const friendshipStatuses: Record<string, UserFriendshipInfo> = {
      u1: { status: "none" },
      // u2 intentionally missing
    };
    render(
      <UserList
        users={users}
        currentUserId="me"
        emptyMessage="Empty"
        friendshipStatuses={friendshipStatuses}
      />
    );
    expect(screen.getByTestId("friend-btn-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("friend-btn-u2")).not.toBeInTheDocument();
  });

  it("does not render any buttons when currentUserId is null", () => {
    const users = [makeUser("u1", "alice")];
    const friendshipStatuses: Record<string, UserFriendshipInfo> = {
      u1: { status: "none" },
    };
    render(
      <UserList
        users={users}
        currentUserId={null}
        emptyMessage="Empty"
        friendshipStatuses={friendshipStatuses}
      />
    );
    expect(screen.queryByTestId("follow-btn-u1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friend-btn-u1")).not.toBeInTheDocument();
  });

  it("shows empty message when users array is empty", () => {
    render(
      <UserList
        users={[]}
        currentUserId="me"
        emptyMessage="No users found."
        friendshipStatuses={{}}
      />
    );
    expect(screen.getByText("No users found.")).toBeInTheDocument();
  });
});
