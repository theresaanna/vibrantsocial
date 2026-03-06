import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatNav } from "@/components/chat-nav";
import type { ConversationListItem } from "@/types/chat";

const mockPathname = vi.fn().mockReturnValue("/feed");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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

vi.mock("ably/react", () => ({
  usePresenceListener: vi.fn().mockReturnValue({
    presenceData: [{ clientId: "user2" }],
  }),
}));

const mockGetConversations = vi.fn();
vi.mock("@/app/chat/actions", () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("2m"),
}));

const mockConversations: ConversationListItem[] = [
  {
    id: "conv1",
    isGroup: false,
    name: null,
    avatarUrl: null,
    participants: [
      {
        id: "user2",
        username: "alice",
        displayName: "Alice",
        name: "Alice",
        avatar: null,
        image: null,
      },
    ],
    lastMessage: {
      content: "Hey there!",
      senderId: "user2",
      createdAt: new Date(),
    },
    unreadCount: 1,
  },
  {
    id: "conv2",
    isGroup: true,
    name: "Dev Team",
    avatarUrl: null,
    participants: [
      {
        id: "user3",
        username: "bob",
        displayName: "Bob",
        name: "Bob",
        avatar: null,
        image: null,
      },
    ],
    lastMessage: {
      content: "Check the PR",
      senderId: "user3",
      createdAt: new Date(),
    },
    unreadCount: 1,
  },
  {
    id: "conv3",
    isGroup: false,
    name: null,
    avatarUrl: null,
    participants: [
      {
        id: "user4",
        username: "charlie",
        displayName: "Charlie",
        name: "Charlie",
        avatar: "https://example.com/charlie.jpg",
        image: null,
      },
    ],
    lastMessage: null,
    unreadCount: 0,
  },
];

describe("ChatNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/feed");
    mockGetConversations.mockResolvedValue(mockConversations);
  });

  it("renders Chat button", () => {
    render(<ChatNav initialConversations={[]} />);
    expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument();
  });

  it("shows unread badge with total count", () => {
    render(<ChatNav initialConversations={mockConversations} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show unread badge when all read", () => {
    const readConversations = mockConversations.map((c) => ({
      ...c,
      unreadCount: 0,
    }));
    render(<ChatNav initialConversations={readConversations} />);
    const button = screen.getByRole("button", { name: /chat/i });
    expect(button.querySelector(".bg-blue-500")).toBeNull();
  });

  it("shows 99+ for large unread counts", () => {
    const manyUnread = Array.from({ length: 100 }, (_, i) => ({
      ...mockConversations[0],
      id: `conv-${i}`,
      unreadCount: 1,
    }));
    render(<ChatNav initialConversations={manyUnread} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("opens pane on click", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("Recent Chats")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Dev Team")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows message preview in pane", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("Hey there!")).toBeInTheDocument();
    expect(screen.getByText("Check the PR")).toBeInTheDocument();
  });

  it("shows 'No messages yet' for conversations without messages", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", async () => {
    mockGetConversations.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ChatNav initialConversations={[]} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
  });

  it("shows presence indicator for 1:1 conversations", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    // user2 (Alice) is online per mock presenceData
    const onlineDots = screen.getAllByLabelText("Online");
    expect(onlineDots.length).toBeGreaterThan(0);
  });

  it("shows offline indicator for users not in presence data", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    // user4 (Charlie) is not in presenceData, should be offline
    const offlineDots = screen.getAllByLabelText("Offline");
    expect(offlineDots.length).toBeGreaterThan(0);
  });

  it("does not show presence indicator for group conversations", async () => {
    const groupOnly: ConversationListItem[] = [
      {
        id: "conv-group",
        isGroup: true,
        name: "Team Chat",
        avatarUrl: null,
        participants: [
          {
            id: "user2",
            username: "alice",
            displayName: "Alice",
            name: "Alice",
            avatar: null,
            image: null,
          },
        ],
        lastMessage: null,
        unreadCount: 0,
      },
    ];
    mockGetConversations.mockResolvedValue(groupOnly);
    const user = userEvent.setup();
    render(<ChatNav initialConversations={groupOnly} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Online")).toBeNull();
      expect(screen.queryByLabelText("Offline")).toBeNull();
    });
  });

  it("toggles pane closed on second click", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);
    const button = screen.getByRole("button", { name: /chat/i });

    await user.click(button);
    expect(screen.getByText("Recent Chats")).toBeInTheDocument();

    await user.click(button);
    // Pane still in DOM but hidden via CSS (pointer-events-none, opacity-0)
    const pane = screen.getByText("Recent Chats").closest(
      "[class*='pointer-events']"
    )!;
    expect(pane.className).toContain("pointer-events-none");
  });

  it("has View all chats link pointing to /chat", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    const viewAll = screen.getByText("View all chats");
    expect(viewAll).toBeInTheDocument();
    expect(viewAll.closest("a")).toHaveAttribute("href", "/chat");
  });

  it("conversation links point to correct chat routes", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    const aliceLink = screen.getByText("Alice").closest("a");
    expect(aliceLink).toHaveAttribute("href", "/chat/conv1");

    const teamLink = screen.getByText("Dev Team").closest("a");
    expect(teamLink).toHaveAttribute("href", "/chat/conv2");
  });

  it("re-fetches conversations when pane opens", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    await waitFor(() => {
      expect(mockGetConversations).toHaveBeenCalledTimes(1);
    });
  });

  it("shows # for group avatar placeholder", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("#")).toBeInTheDocument();
  });

  it("shows first letter for 1:1 avatar placeholder", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders avatar image when available", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    const img = screen.getByAltText("Charlie") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("charlie.jpg");
  });

  it("shows timestamp for conversations with messages", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    const timestamps = screen.getAllByText("2m");
    expect(timestamps.length).toBe(2);
  });

  it("applies bold styling to unread conversation names", async () => {
    const user = userEvent.setup();
    render(<ChatNav initialConversations={mockConversations} />);

    await user.click(screen.getByRole("button", { name: /chat/i }));

    const alice = screen.getByText("Alice");
    expect(alice.className).toContain("font-semibold");

    const charlie = screen.getByText("Charlie");
    expect(charlie.className).toContain("font-medium");
    expect(charlie.className).not.toContain("font-semibold");
  });
});
