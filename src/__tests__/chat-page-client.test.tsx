import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("ably/react", () => ({
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
  }: {
    conversations: Array<{ id: string; name: string | null }>;
  }) => (
    <div data-testid="conversation-list">
      {conversations.map((c) => (
        <div key={c.id} data-testid={`conv-${c.id}`}>
          {c.name || "DM"}
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

import { ChatPageClient } from "@/app/messages/chat-page-client";
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
    lastMessage: null,
    unreadCount: 0,
  },
  {
    id: "conv2",
    isGroup: true,
    name: "Team Chat",
    avatarUrl: null,
    participants: [],
    lastMessage: null,
    unreadCount: 0,
  },
];

const defaultProps = {
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
};

describe("ChatPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders conversation list", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ChatPageClient {...defaultProps} />);
    expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
  });

  it("renders message request list", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ChatPageClient {...defaultProps} />);
    expect(screen.getByTestId("message-request-list")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    render(<ChatPageClient {...defaultProps} />);
    expect(
      screen.getByText("Select a conversation to start messaging")
    ).toBeInTheDocument();
  });

  it("renders conversation list when Ably is ready (presence aware)", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ChatPageClient {...defaultProps} />);
    expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
  });

  it("renders message request list when Ably is ready", () => {
    vi.mocked(useAblyReady).mockReturnValue(true);
    render(<ChatPageClient {...defaultProps} />);
    expect(screen.getByTestId("message-request-list")).toBeInTheDocument();
  });

  it("applies chat-themed class when hasCustomTheme is true", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const { container } = render(
      <ChatPageClient {...defaultProps} hasCustomTheme={true} />
    );
    expect(container.querySelector("main")).toHaveClass("chat-themed");
  });

  it("does not apply chat-themed class when hasCustomTheme is false", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const { container } = render(
      <ChatPageClient {...defaultProps} hasCustomTheme={false} />
    );
    expect(container.querySelector("main")).not.toHaveClass("chat-themed");
  });

  it("applies themeStyle when provided", () => {
    vi.mocked(useAblyReady).mockReturnValue(false);
    const themeStyle = { color: "blue" } as React.CSSProperties;
    const { container } = render(
      <ChatPageClient {...defaultProps} themeStyle={themeStyle} />
    );
    const main = container.querySelector("main");
    expect(main?.style.color).toBe("blue");
  });
});
