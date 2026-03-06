import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationList } from "@/components/chat/conversation-list";
import type { ConversationListItem } from "@/types/chat";

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("2m ago"),
}));

vi.mock("@/app/chat/actions", () => ({
  startConversation: vi.fn(),
  createGroupConversation: vi.fn(),
  searchUsers: vi.fn().mockResolvedValue([]),
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
    unreadCount: 2,
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
    lastMessage: null,
    unreadCount: 0,
  },
];

describe("ConversationList", () => {
  it("renders conversation items", () => {
    render(<ConversationList conversations={mockConversations} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Dev Team")).toBeInTheDocument();
  });

  it("shows Messages header", () => {
    render(<ConversationList conversations={mockConversations} />);
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", () => {
    render(<ConversationList conversations={[]} />);
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start a conversation")
    ).toBeInTheDocument();
  });

  it("shows last message preview", () => {
    render(<ConversationList conversations={mockConversations} />);
    expect(screen.getByText("Hey there!")).toBeInTheDocument();
  });

  it("shows 'No messages yet' for conversations without messages", () => {
    render(<ConversationList conversations={mockConversations} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
