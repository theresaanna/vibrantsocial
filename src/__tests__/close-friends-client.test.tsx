import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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

// Mock useActionState to avoid jsdom form submission issues
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

import { CloseFriendsClient } from "@/app/close-friends/close-friends-client";

const makeFriend = (id: string, username: string, displayName: string | null = null, avatar: string | null = null, usernameFont: string | null = null) => ({
  id,
  username,
  displayName,
  name: displayName,
  avatar,
  image: null,
  profileFrameId: null as string | null,
  usernameFont,
});

const makeCloseFriendEntry = (id: string, friendId: string, friend: ReturnType<typeof makeFriend>) => ({
  id,
  friendId,
  friend,
});

describe("CloseFriendsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── Basic rendering ──────────────────────────────────────

  it("renders explanation text", () => {
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[]} />
    );
    expect(
      screen.getByText(/only you can see this list/i)
    ).toBeInTheDocument();
  });

  it("renders 'Add from your friends' heading", () => {
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[]} />
    );
    expect(screen.getByText("Add from your friends")).toBeInTheDocument();
  });

  // ─── No close friends, no available friends ────────────────

  it("shows no friends message when no close friends and no available", () => {
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[]} />
    );
    expect(
      screen.getByText(
        /you don't have any friends yet/i
      )
    ).toBeInTheDocument();
  });

  // ─── With close friends, no available friends ──────────────

  it("shows all friends on list message when has close friends but no available", () => {
    const closeFriends = [
      makeCloseFriendEntry("cf1", "f1", makeFriend("f1", "alice", "Alice")),
    ];
    render(
      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={[]}
      />
    );
    expect(
      screen.getByText(
        /all your friends are already on your close friends list/i
      )
    ).toBeInTheDocument();
  });

  // ─── Close friends list rendering ──────────────────────────

  it("renders close friends count in heading", () => {
    const closeFriends = [
      makeCloseFriendEntry("cf1", "f1", makeFriend("f1", "alice", "Alice")),
      makeCloseFriendEntry("cf2", "f2", makeFriend("f2", "bob", "Bob")),
    ];
    render(
      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={[]}
      />
    );
    expect(screen.getByText(/your close friends \(2\)/i)).toBeInTheDocument();
  });

  it("renders close friend display names", () => {
    const closeFriends = [
      makeCloseFriendEntry("cf1", "f1", makeFriend("f1", "alice", "Alice")),
    ];
    render(
      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={[]}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders close friend username link", () => {
    const closeFriends = [
      makeCloseFriendEntry("cf1", "f1", makeFriend("f1", "alice", "Alice")),
    ];
    render(
      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={[]}
      />
    );
    const link = screen.getByRole("link", { name: "Alice" });
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("renders Remove button for close friends", () => {
    const closeFriends = [
      makeCloseFriendEntry("cf1", "f1", makeFriend("f1", "alice", "Alice")),
    ];
    render(
      <CloseFriendsClient
        closeFriends={closeFriends}
        availableFriends={[]}
      />
    );
    expect(
      screen.getByRole("button", { name: /remove/i })
    ).toBeInTheDocument();
  });

  it("does not show close friends section when empty", () => {
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[]} />
    );
    expect(
      screen.queryByText(/your close friends \(\d+\)/i)
    ).not.toBeInTheDocument();
  });

  // ─── Available friends rendering ───────────────────────────

  it("renders available friends with Add buttons", () => {
    const available = [makeFriend("f1", "charlie", "Charlie")];
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={available} />
    );
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("renders available friend profile links", () => {
    const available = [makeFriend("f1", "charlie", "Charlie")];
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={available} />
    );
    const link = screen.getByRole("link", { name: "Charlie" });
    expect(link).toHaveAttribute("href", "/charlie");
  });

  // ─── Avatar rendering ─────────────────────────────────────

  it("shows avatar image when provided", () => {
    const available = [
      makeFriend("f1", "charlie", "Charlie", "https://example.com/avatar.jpg"),
    ];
    const { container } = render(
      <CloseFriendsClient closeFriends={[]} availableFriends={available} />
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows initial when no avatar", () => {
    const available = [makeFriend("f1", "charlie", "Charlie")];
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={available} />
    );
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows initial from username when no displayName", () => {
    const available = [makeFriend("f1", "dave", null)];
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={available} />
    );
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  // ─── Fallback display names ────────────────────────────────

  it("falls back to name when no displayName", () => {
    const friend = {
      id: "f1",
      username: "eve",
      displayName: null,
      name: "Eve Name",
      avatar: null,
      image: null,
      profileFrameId: null,
      usernameFont: null,
    };
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[friend]} />
    );
    expect(screen.getByText("Eve Name")).toBeInTheDocument();
  });

  it("falls back to username when no displayName or name", () => {
    const friend = {
      id: "f1",
      username: "frank",
      displayName: null,
      name: null,
      avatar: null,
      image: null,
      profileFrameId: null,
      usernameFont: null,
    };
    render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[friend]} />
    );
    // The link text should show username as fallback
    const links = screen.getAllByText("frank");
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
