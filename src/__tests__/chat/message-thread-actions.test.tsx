import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock all dependencies before importing the component
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "currentUser" } } }),
}));

vi.mock("ably/react", () => ({
  useChannel: vi.fn(),
}));

vi.mock("@/hooks/use-chat-messages", () => ({
  useChatMessages: vi.fn(() => ({
    messages: [],
    setMessages: vi.fn(),
    channelName: "chat:conv1",
  })),
}));

vi.mock("@/hooks/use-typing-indicator", () => ({
  useTypingIndicator: vi.fn(() => ({
    typingUsers: [],
    keystroke: vi.fn(),
    stopTyping: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-read-receipts", () => ({
  useReadReceipts: vi.fn(() => ({
    readTimestamps: new Map(),
  })),
}));

vi.mock("@/app/messages/actions", () => ({
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  markConversationRead: vi.fn(),
  getMessages: vi.fn(),
  toggleReaction: vi.fn(),
  leaveConversation: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/feed/block-actions", () => ({
  toggleBlock: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));

vi.mock("@/components/report-modal", () => ({
  ReportModal: ({ isOpen, contentType, contentId }: { isOpen: boolean; contentType: string; contentId: string }) =>
    isOpen ? <div data-testid="report-modal">Report {contentType} {contentId}</div> : null,
}));

// JSDOM doesn't implement HTMLDialogElement methods or scrollIntoView
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

import { MessageThread } from "@/components/chat/message-thread";
import { leaveConversation } from "@/app/messages/actions";
import type { ConversationWithParticipants } from "@/types/chat";

const baseConversation: ConversationWithParticipants = {
  id: "conv1",
  isGroup: false,
  name: null,
  avatarUrl: null,
  participants: [
    {
      id: "p1",
      userId: "currentUser",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "currentUser",
        username: "me",
        displayName: "Me",
        name: "Me",
        avatar: null,
        image: null,
        profileFrameId: null,
      },
    },
    {
      id: "p2",
      userId: "otherUser",
      isAdmin: false,
      lastReadAt: null,
      user: {
        id: "otherUser",
        username: "other",
        displayName: "Other",
        name: "Other",
        avatar: null,
        image: null,
        profileFrameId: null,
      },
    },
  ],
};

describe("MessageThread actions menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders three-dot menu button", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );
    expect(screen.getByTestId("chat-options-button")).toBeInTheDocument();
  });

  it("opens menu with Report, Block, and Delete options", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));

    expect(screen.getByTestId("chat-report-button")).toBeInTheDocument();
    expect(screen.getByTestId("chat-block-button")).toBeInTheDocument();
    expect(screen.getByTestId("chat-delete-button")).toBeInTheDocument();
  });

  it("does not show Block button in group chats", async () => {
    const groupConversation = {
      ...baseConversation,
      isGroup: true,
      name: "Group Chat",
    };
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={groupConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));

    expect(screen.getByTestId("chat-report-button")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-block-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-delete-button")).toBeInTheDocument();
  });

  it("opens report modal when Report is clicked", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));
    await userEvent.click(screen.getByTestId("chat-report-button"));

    expect(screen.getByTestId("report-modal")).toBeInTheDocument();
    expect(screen.getByText("Report conversation conv1")).toBeInTheDocument();
  });

  it("shows block confirmation dialog when Block is clicked", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));
    await userEvent.click(screen.getByTestId("chat-block-button"));

    expect(screen.getByText("Block?")).toBeInTheDocument();
    expect(screen.getByText(/block this user/i)).toBeInTheDocument();
  });

  it("shows delete confirmation with note about other participants", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));
    await userEvent.click(screen.getByTestId("chat-delete-button"));

    expect(screen.getByText("Delete chat?")).toBeInTheDocument();
    expect(screen.getByText(/other participants will still have access/i)).toBeInTheDocument();
  });

  it("calls leaveConversation and navigates on delete confirm", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));
    await userEvent.click(screen.getByTestId("chat-delete-button"));

    // Click the "Delete" confirm button in the dialog
    const deleteButtons = screen.getAllByText("Delete");
    await userEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(leaveConversation).toHaveBeenCalledWith("conv1");
  });

  it("shows blocked message in input when isBlocked is true", () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
        isBlocked={true}
      />
    );

    expect(screen.getByText("You cannot send messages in this conversation.")).toBeInTheDocument();
  });

  it("shows Unblock text when already blocked", async () => {
    render(
      <MessageThread
        conversationId="conv1"
        initialMessages={[]}
        conversation={baseConversation}
        currentUserId="currentUser"
        isBlocked={true}
      />
    );

    await userEvent.click(screen.getByTestId("chat-options-button"));
    expect(screen.getByText("Unblock")).toBeInTheDocument();
  });
});
