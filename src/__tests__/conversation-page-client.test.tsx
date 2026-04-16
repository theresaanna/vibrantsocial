import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Ably
vi.mock("ably/react", () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  usePresenceListener: () => ({
    presenceData: [],
  }),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn(),
}));

vi.mock("@/components/chat/conversation-list", () => ({
  ConversationList: ({
    conversations,
    activeId,
  }: {
    conversations: Array<{ id: string; name: string | null }>;
    activeId?: string;
  }) => (
    <div data-testid="conversation-list">
      {conversations.map((c) => (
        <div key={c.id} data-testid={`conv-${c.id}`}>
          {c.name || "DM"}
          {activeId === c.id && <span data-testid="active-indicator">active</span>}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/chat/message-request-list", () => ({
  MessageRequestList: ({
    requests,
  }: {
    requests: Array<{ id: string }>;
  }) => (
    <div data-testid="message-request-list">
      {requests.length} requests
    </div>
  ),
}));

vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: ({
    conversationId,
    currentUserId,
  }: {
    conversationId: string;
    currentUserId: string;
  }) => (
    <div data-testid="message-thread">
      <span data-testid="thread-conv-id">{conversationId}</span>
      <span data-testid="thread-user-id">{currentUserId}</span>
    </div>
  ),
}));

vi.mock("@/app/messages/actions", () => ({
  getConversations: vi.fn().mockResolvedValue([]),
}));

import { ConversationPageClient } from "@/app/messages/[conversationId]/conversation-page-client";
import { useAblyReady } from "@/app/providers";

const mockConversations = [
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
      content: "Hello",
      senderId: "user2",
      createdAt: new Date(),
    },
    unreadCount: 0,
  },
];

const mockConversation = {
  id: "conv1",
  isGroup: false,
  name: null,
  avatarUrl: null,
  participants: [
    {
      id: "p1",
      userId: "user1",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "user1",
        username: "me",
        displayName: "Me",
        name: "Me",
        avatar: null,
        image: null,
      },
    },
    {
      id: "p2",
      userId: "user2",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "user2",
        username: "alice",
        displayName: "Alice",
        name: "Alice",
        avatar: null,
        image: null,
      },
    },
  ],
};

const defaultProps = {
  conversationId: "conv1",
  conversations: mockConversations,
  messageRequests: [] as Array<{
    id: string;
    senderId: string;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    createdAt: Date;
    sender: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
      avatar: string | null;
      image: string | null;
    };
  }>,
  initialMessages: [],
  conversation: mockConversation,
  currentUserId: "user1",
  phoneVerified: true,
};

describe("ConversationPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Connecting...' when Ably is not ready", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("renders conversation list when Ably is not ready (non-presence aware)", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
  });

  it("renders message request list", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByTestId("message-request-list")).toBeInTheDocument();
  });

  it("renders message thread when Ably is ready", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByTestId("message-thread")).toBeInTheDocument();
  });

  it("passes conversationId to message thread", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByTestId("thread-conv-id")).toHaveTextContent("conv1");
  });

  it("passes currentUserId to message thread", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.getByTestId("thread-user-id")).toHaveTextContent("user1");
  });

  it("does not show Connecting when Ably is ready", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ConversationPageClient {...defaultProps} />);
    expect(screen.queryByText("Connecting...")).not.toBeInTheDocument();
  });

  it("applies chat-themed class when hasCustomTheme is true", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const { container } = render(
      <ConversationPageClient {...defaultProps} hasCustomTheme={true} />
    );
    expect(container.querySelector("main")).toHaveClass("chat-themed");
  });

  it("does not apply chat-themed class when hasCustomTheme is false", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const { container } = render(
      <ConversationPageClient {...defaultProps} hasCustomTheme={false} />
    );
    expect(container.querySelector("main")).not.toHaveClass("chat-themed");
  });

  it("applies themeStyle when provided", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const themeStyle = { backgroundColor: "red" } as React.CSSProperties;
    const { container } = render(
      <ConversationPageClient {...defaultProps} themeStyle={themeStyle} />
    );
    const main = container.querySelector("main");
    expect(main?.style.backgroundColor).toBe("red");
  });
});
