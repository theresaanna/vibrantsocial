import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageThread } from "@/components/chat/message-thread";
import type { MessageData, ConversationWithParticipants } from "@/types/chat";

// scrollIntoView is not available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock ably/react
vi.mock("ably/react", () => ({
  useChannel: vi.fn().mockReturnValue({ channel: null }),
  usePresence: vi.fn(),
  usePresenceListener: vi.fn().mockReturnValue({ presenceData: [] }),
}));

vi.mock("@/app/chat/actions", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: "new-msg" }),
  editMessage: vi.fn().mockResolvedValue({ success: true }),
  deleteMessage: vi.fn().mockResolvedValue({ success: true }),
  markConversationRead: vi.fn().mockResolvedValue({ success: true }),
  getMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({ data: { user: { id: "me" } } }),
}));

const mockConversation: ConversationWithParticipants = {
  id: "conv1",
  isGroup: false,
  name: null,
  avatarUrl: null,
  participants: [
    {
      id: "p1",
      userId: "me",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "me",
        username: "me",
        displayName: "Me",
        name: "Me",
        avatar: null,
        image: null,
      },
    },
    {
      id: "p2",
      userId: "other",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "other",
        username: "alice",
        displayName: "Alice",
        name: "Alice",
        avatar: null,
        image: null,
      },
    },
  ],
};

const mockMessages: MessageData[] = [
  {
    id: "msg1",
    conversationId: "conv1",
    senderId: "other",
    content: "Hey there!",
    editedAt: null,
    deletedAt: null,
    createdAt: new Date("2024-01-01T10:00:00"),
    sender: mockConversation.participants[1].user,
    reactions: [],
  },
  {
    id: "msg2",
    conversationId: "conv1",
    senderId: "me",
    content: "Hi Alice!",
    editedAt: null,
    deletedAt: null,
    createdAt: new Date("2024-01-01T10:01:00"),
    sender: mockConversation.participants[0].user,
    reactions: [],
  },
];

describe("MessageThread", () => {
  it("renders initial messages", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={mockMessages}
        conversation={mockConversation}
        currentUserId="me"
      />
    );
    expect(screen.getByText("Hey there!")).toBeInTheDocument();
    expect(screen.getByText("Hi Alice!")).toBeInTheDocument();
  });

  it("shows conversation partner name in header", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={mockMessages}
        conversation={mockConversation}
        currentUserId="me"
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows offline status by default", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={mockConversation}
        currentUserId="me"
      />
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows online status when user is online", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={mockConversation}
        currentUserId="me"
        onlineUserIds={new Set(["other"])}
      />
    );
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("renders message input", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={mockConversation}
        currentUserId="me"
      />
    );
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeInTheDocument();
  });

  it("shows group member count in header for group chats", () => {
    const groupConv: ConversationWithParticipants = {
      ...mockConversation,
      isGroup: true,
      name: "Test Group",
    };
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={groupConv}
        currentUserId="me"
      />
    );
    expect(screen.getByText("Test Group")).toBeInTheDocument();
    expect(screen.getByText("2 members")).toBeInTheDocument();
  });
});
