import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageBubble } from "@/components/chat/message-bubble";
import type { MessageData, ChatUserProfile } from "@/types/chat";

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("@/components/chat/media-renderer", () => ({
  MediaRenderer: ({ mediaUrl, mediaType, mediaFileName }: { mediaUrl: string; mediaType: string; mediaFileName: string | null }) => (
    <div data-testid={`media-${mediaType}`}>{mediaFileName ?? mediaUrl}</div>
  ),
}));

vi.mock("@/components/link-preview-card", () => ({
  LinkPreviewCard: ({ url, onLoadChange }: { url: string; onLoadChange?: (status: "loading" | "loaded" | "empty") => void }) => {
    // Simulate immediate "loaded" callback like the real component does after fetch
    if (onLoadChange) {
      // Use queueMicrotask to avoid calling setState during render
      queueMicrotask(() => onLoadChange("loaded"));
    }
    return <div data-testid="link-preview-card">{url}</div>;
  },
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
  mediaUrl: null,
  mediaType: null,
  mediaFileName: null,
  mediaFileSize: null,
  isNsfw: false,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date("2024-01-01"),
  sender: baseSender,
  reactions: [],
  replyTo: null,
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

  // Media attachment tests
  it("renders image attachment", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/photo.jpg", mediaType: "image" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-image")).toBeInTheDocument();
  });

  it("renders video attachment", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/video.mp4", mediaType: "video" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-video")).toBeInTheDocument();
  });

  it("renders audio attachment", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/audio.webm", mediaType: "audio" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-audio")).toBeInTheDocument();
  });

  it("renders document attachment", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/doc.pdf", mediaType: "document" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-document")).toBeInTheDocument();
  });

  it("renders media with text", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/photo.jpg", mediaType: "image", content: "Check this out" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-image")).toBeInTheDocument();
    expect(screen.getByText("Check this out")).toBeInTheDocument();
  });

  it("renders media-only message without text paragraph", () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, mediaUrl: "https://example.com/photo.jpg", mediaType: "image", content: "" }}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByTestId("media-image")).toBeInTheDocument();
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument();
  });

  // Seen by indicator tests
  it("shows SeenByIndicator for own messages in group chat with seenBy data", () => {
    const seenByUsers: ChatUserProfile[] = [
      { id: "u2", username: "bob", displayName: "Bob", name: "Bob", avatar: null, image: null },
    ];
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="read"
        seenBy={seenByUsers}
      />
    );
    expect(screen.getByLabelText("Seen by Bob")).toBeInTheDocument();
  });

  it("does not show SeenByIndicator for non-own messages", () => {
    const seenByUsers: ChatUserProfile[] = [
      { id: "u2", username: "bob", displayName: "Bob", name: "Bob", avatar: null, image: null },
    ];
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="sent"
        seenBy={seenByUsers}
      />
    );
    expect(screen.queryByLabelText("Seen by Bob")).not.toBeInTheDocument();
  });

  it("does not show SeenByIndicator in 1:1 chats", () => {
    const seenByUsers: ChatUserProfile[] = [
      { id: "u2", username: "bob", displayName: "Bob", name: "Bob", avatar: null, image: null },
    ];
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="read"
        seenBy={seenByUsers}
      />
    );
    expect(screen.queryByLabelText("Seen by Bob")).not.toBeInTheDocument();
  });

  it("does not show SeenByIndicator when seenBy is not provided", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="read"
      />
    );
    expect(screen.queryByText("Seen by")).not.toBeInTheDocument();
  });

  it("does not show SeenByIndicator when seenBy is empty", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={true}
        senderProfile={baseSender}
        isGroup={true}
        readStatus="delivered"
        seenBy={[]}
      />
    );
    expect(screen.queryByText("Seen by")).not.toBeInTheDocument();
  });

  // Reply feature tests
  it("shows reply quote when message has replyTo", () => {
    const messageWithReply: MessageData = {
      ...baseMessage,
      replyTo: {
        id: "original-msg",
        content: "This is the original message",
        senderId: "sender2",
        senderName: "Bob",
        mediaType: null,
        deletedAt: null,
      },
    };
    render(
      <MessageBubble
        message={messageWithReply}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("This is the original message")).toBeInTheDocument();
    expect(screen.getByTestId("reply-quote")).toBeInTheDocument();
  });

  it("shows truncated content in reply quote for long messages", () => {
    const longContent = "A".repeat(100);
    const messageWithReply: MessageData = {
      ...baseMessage,
      replyTo: {
        id: "original-msg",
        content: longContent,
        senderId: "sender2",
        senderName: "Bob",
        mediaType: null,
        deletedAt: null,
      },
    };
    render(
      <MessageBubble
        message={messageWithReply}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText(longContent.slice(0, 80) + "...")).toBeInTheDocument();
  });

  it("shows deleted message text in reply quote when original was deleted", () => {
    const messageWithReply: MessageData = {
      ...baseMessage,
      replyTo: {
        id: "original-msg",
        content: "Some old content",
        senderId: "sender2",
        senderName: "Bob",
        mediaType: null,
        deletedAt: new Date("2024-01-02"),
      },
    };
    render(
      <MessageBubble
        message={messageWithReply}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
  });

  it("shows media type in reply quote when reply has media but no content", () => {
    const messageWithReply: MessageData = {
      ...baseMessage,
      replyTo: {
        id: "original-msg",
        content: "",
        senderId: "sender2",
        senderName: "Bob",
        mediaType: "image",
        deletedAt: null,
      },
    };
    render(
      <MessageBubble
        message={messageWithReply}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByText("[image]")).toBeInTheDocument();
  });

  it("calls onScrollToMessage when reply quote is clicked", async () => {
    const user = userEvent.setup();
    const onScrollToMessage = vi.fn();
    const messageWithReply: MessageData = {
      ...baseMessage,
      replyTo: {
        id: "original-msg",
        content: "Original content",
        senderId: "sender2",
        senderName: "Bob",
        mediaType: null,
        deletedAt: null,
      },
    };
    render(
      <MessageBubble
        message={messageWithReply}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        onScrollToMessage={onScrollToMessage}
      />
    );
    await user.click(screen.getByTestId("reply-quote"));
    expect(onScrollToMessage).toHaveBeenCalledWith("original-msg");
  });

  it("shows reply button on hover", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.getByLabelText("Reply")).toBeInTheDocument();
  });

  it("calls onReply when reply button is clicked", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
        onReply={onReply}
      />
    );
    await user.click(screen.getByLabelText("Reply"));
    expect(onReply).toHaveBeenCalledWith(baseMessage);
  });

  it("does not render reply quote when replyTo is null", () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOwn={false}
        senderProfile={baseSender}
        isGroup={false}
        readStatus="sent"
      />
    );
    expect(screen.queryByTestId("reply-quote")).not.toBeInTheDocument();
  });

  // Link preview tests
  describe("link preview", () => {
    it("shows link preview for message containing a URL", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Check out https://example.com" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("chat-link-preview")).toBeInTheDocument();
      expect(screen.getByTestId("link-preview-card")).toHaveTextContent("https://example.com");
    });

    it("shows link preview for bare domain URLs", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Visit example.com for more info" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("chat-link-preview")).toBeInTheDocument();
      expect(screen.getByTestId("link-preview-card")).toHaveTextContent("https://example.com");
    });

    it("does not show link preview for messages without URLs", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Just a plain message" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("does not show link preview for empty content", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "", mediaUrl: "https://example.com/img.jpg", mediaType: "image" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("shows dismiss button for link preview after load", async () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "See https://example.com" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      await vi.waitFor(() => {
        expect(screen.getByTestId("dismiss-link-preview")).toBeInTheDocument();
      });
    });

    it("hides link preview when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "See https://example.com" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      await vi.waitFor(() => {
        expect(screen.getByTestId("dismiss-link-preview")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("dismiss-link-preview"));

      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("shows link preview for own messages", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Check https://example.com" }}
          isOwn={true}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("chat-link-preview")).toBeInTheDocument();
    });

    it("does not show link preview for deleted messages", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Check https://example.com", deletedAt: new Date() }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("does not show link preview for email-only content", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Email me at test@example.com" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      // Email addresses should not trigger link preview
      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("shows link preview alongside media", () => {
      render(
        <MessageBubble
          message={{
            ...baseMessage,
            content: "Photo from https://example.com",
            mediaUrl: "https://example.com/photo.jpg",
            mediaType: "image",
          }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("media-image")).toBeInTheDocument();
      expect(screen.getByTestId("chat-link-preview")).toBeInTheDocument();
    });

    it("does not show link preview for emoji-only messages with URL-like text", () => {
      // Emoji-only messages render differently (large text, no bubble)
      // They shouldn't have link previews since there's no URL
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "\u{1F44D}\u{1F44D}" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.queryByTestId("chat-link-preview")).not.toBeInTheDocument();
    });

    it("renders image URL inline as an image instead of link preview card", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Look at https://example.com/photo.jpg" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("chat-link-preview")).toBeInTheDocument();
      // Should render an inline img, not the LinkPreviewCard mock
      const img = screen.getByTestId("chat-link-preview").querySelector("img");
      expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
      expect(screen.queryByTestId("link-preview-card")).not.toBeInTheDocument();
    });

    it("renders image URL with query params inline", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "https://cdn.example.com/img.png?w=400" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      const img = screen.getByTestId("chat-link-preview").querySelector("img");
      expect(img).toHaveAttribute("src", "https://cdn.example.com/img.png?w=400");
    });

    it("uses LinkPreviewCard for non-image URLs", () => {
      render(
        <MessageBubble
          message={{ ...baseMessage, content: "Check https://example.com" }}
          isOwn={false}
          senderProfile={baseSender}
          isGroup={false}
          readStatus="sent"
        />
      );
      expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();
    });
  });
});
