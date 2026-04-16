import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatFriendsList } from "@/components/chat/chat-friends-list";
import type { ChatUserProfile } from "@/types/chat";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/app/messages/actions", () => ({
  startConversation: vi.fn().mockResolvedValue({ success: true, conversationId: "conv-1" }),
}));

const makeFriend = (id: string, username: string, displayName: string): ChatUserProfile => ({
  id,
  username,
  displayName,
  name: displayName,
  avatar: null,
  image: null,
  profileFrameId: null,
});

describe("ChatFriendsList", () => {
  // ─── Empty state ───────────────────────────────────────────

  it("renders nothing when friends list is empty", () => {
    const { container } = render(<ChatFriendsList friends={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // ─── With friends ─────────────────────────────────────────

  it("shows friends with their display names", () => {
    const friends = [
      makeFriend("f1", "alice", "Alice"),
      makeFriend("f2", "bob", "Bob"),
    ];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows 'Friends' header text", () => {
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });

  it("shows count badge with number of friends", () => {
    const friends = [
      makeFriend("f1", "alice", "Alice"),
      makeFriend("f2", "bob", "Bob"),
      makeFriend("f3", "carol", "Carol"),
    ];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows count badge of 1 for single friend", () => {
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  // ─── Expand/collapse ──────────────────────────────────────

  it("is expanded by default, showing friend entries", () => {
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("collapses when header button is clicked", async () => {
    const user = userEvent.setup();
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);

    await user.click(screen.getByText("Friends"));

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("expands again when header button is clicked twice", async () => {
    const user = userEvent.setup();
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);

    await user.click(screen.getByText("Friends"));
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();

    await user.click(screen.getByText("Friends"));
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  // ─── Friend avatar initials ───────────────────────────────

  it("renders avatar initial from display name", () => {
    const friends = [makeFriend("f1", "alice", "Alice")];
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  // ─── Fallback display name ────────────────────────────────

  it("falls back to username when displayName is null", () => {
    const friends = [makeFriend("f1", "alice", "Alice")];
    friends[0].displayName = null;
    render(<ChatFriendsList friends={friends} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });
});
