import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockAcceptFriendRequest = vi.fn().mockResolvedValue({ success: false, message: "" });
const mockDeclineFriendRequest = vi.fn().mockResolvedValue({ success: false, message: "" });

vi.mock("@/app/feed/friend-actions", () => ({
  acceptFriendRequest: (...args: unknown[]) => mockAcceptFriendRequest(...args),
  declineFriendRequest: (...args: unknown[]) => mockDeclineFriendRequest(...args),
}));

import { FriendRequestList } from "@/components/friend-request-list";

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    profileFrameId: string | null;
    image: string | null;
  };
}

const makeRequest = (
  id: string,
  senderId: string,
  username: string,
  displayName: string
): FriendRequest => ({
  id,
  sender: {
    id: senderId,
    username,
    displayName,
    name: displayName,
    avatar: null,
    profileFrameId: null,
    image: null,
  },
});

describe("FriendRequestList", () => {
  // ─── Empty state ───────────────────────────────────────────

  it("shows empty state when no requests", () => {
    render(<FriendRequestList requests={[]} />);
    expect(screen.getByText("No pending friend requests.")).toBeInTheDocument();
  });

  // ─── With requests ────────────────────────────────────────

  it("renders request cards with sender display name", () => {
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<FriendRequestList requests={requests} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders sender usernames", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<FriendRequestList requests={requests} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("shows 'wants to be your friend' text for each request", () => {
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<FriendRequestList requests={requests} />);
    const wantsTexts = screen.getAllByText("wants to be your friend");
    expect(wantsTexts).toHaveLength(2);
  });

  it("has Accept and Decline buttons for each request", () => {
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<FriendRequestList requests={requests} />);
    const acceptButtons = screen.getAllByRole("button", { name: "Accept" });
    const declineButtons = screen.getAllByRole("button", { name: "Decline" });
    expect(acceptButtons).toHaveLength(2);
    expect(declineButtons).toHaveLength(2);
  });

  it("links sender name to their profile", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<FriendRequestList requests={requests} />);
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/alice")).toBe(true);
  });

  it("includes hidden requestId inputs for accept and decline forms", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    const { container } = render(<FriendRequestList requests={requests} />);
    const hiddenInputs = container.querySelectorAll("input[name='requestId']");
    expect(hiddenInputs).toHaveLength(2);
    hiddenInputs.forEach((input) => {
      expect(input).toHaveAttribute("value", "r1");
    });
  });

  it("falls back to username when displayName is null", () => {
    const requests = [makeRequest("r1", "s1", "alice", null as unknown as string)];
    requests[0].sender.displayName = null;
    render(<FriendRequestList requests={requests} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("renders avatar initial from display name", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<FriendRequestList requests={requests} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
