import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/message-bubble";
import type { MessageData, ChatUserProfile } from "@/types/chat";

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
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
});
