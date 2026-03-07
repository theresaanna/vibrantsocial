import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageBubble } from "@/components/chat/message-bubble";
import type { MessageData, ChatUserProfile } from "@/types/chat";

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("emoji-picker-react", () => ({
  __esModule: true,
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <div data-testid="emoji-picker">
      <button
        data-testid="pick-emoji-thumbsup"
        onClick={() => onEmojiClick({ emoji: "\u{1F44D}" })}
      >
        Pick thumbsup
      </button>
    </div>
  ),
}));

const baseSender: ChatUserProfile = {
  id: "sender1",
  username: "alice",
  displayName: "Alice",
  name: "Alice Smith",
  avatar: null,
  image: null,
};

const baseMessage: MessageData = {
  id: "msg1",
  conversationId: "conv1",
  senderId: "sender1",
  content: "Hello world",
  editedAt: null,
  deletedAt: null,
  createdAt: new Date("2024-01-01"),
  sender: baseSender,
  reactions: [],
};

describe("MessageBubble", () => {
  it("renders message content", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows deleted message placeholder", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, deletedAt: new Date() }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
  });

  it("shows edited label when message was edited", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, editedAt: new Date() }}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("shows sender name in group chat for non-own messages", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="sent"
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("does not show sender name for own messages in group chat", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="sent"
      />
    );
    // The name text above the bubble should not appear for own messages
    const nameElements = screen.queryAllByText("Alice");
    // There should be no name label element (only the message content could match)
    expect(
      nameElements.every(
        (el) => !el.classList.contains("text-xs") || !el.classList.contains("font-medium")
      )
    ).toBe(true);
  });

  it("shows read receipt indicator for own messages", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="read"
      />
    );
    expect(screen.getByLabelText("Read")).toBeInTheDocument();
  });

  it("shows timestamp", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });

  // Emoji reaction tests
  it("displays reaction badges when message has reactions", () => {
    const messageWithReactions: MessageData = {
      ...baseMessage,
      reactions: [
        { emoji: "\u{1F44D}", userIds: ["user1", "user2"] },
        { emoji: "\u{2764}\u{FE0F}", userIds: ["user1"] },
      ],
    };
    render(
      <MessageBubble
        message={messageWithReactions}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        currentUserId="user3"
      />
    );
    expect(screen.getByText("\u{1F44D}")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("\u{2764}\u{FE0F}")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("highlights reaction badge when current user has reacted", () => {
    const messageWithReactions: MessageData = {
      ...baseMessage,
      reactions: [{ emoji: "\u{1F44D}", userIds: ["currentUser"] }],
    };
    render(
      <MessageBubble
        message={messageWithReactions}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        currentUserId="currentUser"
      />
    );
    const reactionButton = screen.getByLabelText("\u{1F44D} 1");
    expect(reactionButton.className).toContain("border-blue-300");
  });

  it("does not highlight reaction badge when current user has not reacted", () => {
    const messageWithReactions: MessageData = {
      ...baseMessage,
      reactions: [{ emoji: "\u{1F44D}", userIds: ["otherUser"] }],
    };
    render(
      <MessageBubble
        message={messageWithReactions}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        currentUserId="currentUser"
      />
    );
    const reactionButton = screen.getByLabelText("\u{1F44D} 1");
    expect(reactionButton.className).toContain("border-zinc-200");
  });

  it("calls onReaction when clicking a reaction badge", async () => {
    const user = userEvent.setup();
    const onReaction = vi.fn();
    const messageWithReactions: MessageData = {
      ...baseMessage,
      reactions: [{ emoji: "\u{1F44D}", userIds: ["otherUser"] }],
    };
    render(
      <MessageBubble
        message={messageWithReactions}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        currentUserId="currentUser"
        onReaction={onReaction}
      />
    );
    await user.click(screen.getByLabelText("\u{1F44D} 1"));
    expect(onReaction).toHaveBeenCalledWith("msg1", "\u{1F44D}");
  });

  it("shows add reaction button on hover", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByLabelText("Add reaction")).toBeInTheDocument();
  });

  it("shows emoji picker when add reaction button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        onReaction={vi.fn()}
      />
    );
    await user.click(screen.getByLabelText("Add reaction"));
    expect(screen.getByTestId("emoji-picker")).toBeInTheDocument();
  });

  it("calls onReaction when picking an emoji from the picker", () => {
    const onReaction = vi.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        onReaction={onReaction}
      />
    );
    fireEvent.click(screen.getByLabelText("Add reaction"));
    fireEvent.click(screen.getByTestId("pick-emoji-thumbsup"));
    expect(onReaction).toHaveBeenCalledWith("msg1", "\u{1F44D}");
  });

  it("does not show reactions section when there are no reactions", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.queryByText("\u{1F44D}")).not.toBeInTheDocument();
  });

  // External editing via up-arrow
  it("enters edit mode when isEditing prop is true", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        isEditing={true}
        onEditingChange={vi.fn()}
      />
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onEditingChange(false) when cancel is clicked during external edit", async () => {
    const user = userEvent.setup();
    const onEditingChange = vi.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        isEditing={true}
        onEditingChange={onEditingChange}
      />
    );
    await user.click(screen.getByText("Cancel"));
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });
});
