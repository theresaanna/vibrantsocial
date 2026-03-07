import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserList } from "@/components/user-list";
import type { FollowUser } from "@/app/feed/follow-actions";

vi.mock("@/components/follow-button", () => ({
  FollowButton: ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => (
    <button data-testid={`follow-btn-${userId}`}>
      {isFollowing ? "Remove Friend" : "Add Friend"}
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
  isFollowing,
});

describe("UserList", () => {
  it("shows empty message when no users", () => {
    render(
      <UserList users={[]} currentUserId="me" emptyMessage="No followers yet." />
    );
    expect(screen.getByText("No followers yet.")).toBeInTheDocument();
  });

  it("renders users with display names and usernames", () => {
    const users = [makeUser("u1", "alice"), makeUser("u2", "bob")];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("renders follow buttons for other users", () => {
    const users = [makeUser("u1", "alice"), makeUser("u2", "bob", true)];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    expect(screen.getByTestId("follow-btn-u1")).toHaveTextContent("Add Friend");
    expect(screen.getByTestId("follow-btn-u2")).toHaveTextContent("Remove Friend");
  });

  it("does not render follow button for own profile", () => {
    const users = [makeUser("me", "myself"), makeUser("u2", "bob")];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    expect(screen.queryByTestId("follow-btn-me")).not.toBeInTheDocument();
    expect(screen.getByTestId("follow-btn-u2")).toBeInTheDocument();
  });

  it("does not render follow buttons when not logged in", () => {
    const users = [makeUser("u1", "alice")];
    render(
      <UserList users={users} currentUserId={null} emptyMessage="Empty" />
    );
    expect(screen.queryByTestId("follow-btn-u1")).not.toBeInTheDocument();
  });

  it("links to user profiles", () => {
    const users = [makeUser("u1", "alice")];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/alice")).toBe(true);
  });

  it("renders avatar initial when no image", () => {
    const users = [makeUser("u1", "alice")];
    render(
      <UserList users={users} currentUserId="me" emptyMessage="Empty" />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
