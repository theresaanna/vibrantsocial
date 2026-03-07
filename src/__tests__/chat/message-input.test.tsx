import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "@/components/chat/message-input";
import type { MessageData, ChatUserProfile } from "@/types/chat";

vi.mock("@/components/chat/voice-recorder", () => ({
  VoiceRecorder: ({ onRecordingComplete, onCancel }: { onRecordingComplete: (blob: Blob) => void; onCancel: () => void }) => (
    <div data-testid="voice-recorder">
      <button data-testid="mock-voice-stop" onClick={() => onRecordingComplete(new Blob(["audio"], { type: "audio/webm" }))}>Stop</button>
      <button data-testid="mock-voice-cancel" onClick={() => onCancel()}>Cancel</button>
    </div>
  ),
}));

describe("MessageInput", () => {
  it("renders input and attach button", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Attach file")).toBeInTheDocument();
  });

  it("shows voice record button when input is empty instead of send button", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    expect(screen.getByTestId("voice-record-button")).toBeInTheDocument();
    expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();
  });

  it("enables send button when input has text", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Hello"
    );
    expect(screen.getByLabelText("Send message")).not.toBeDisabled();
  });

  it("calls onKeystroke when typing", async () => {
    const onKeystroke = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={onKeystroke}
        onStopTyping={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Hi"
    );
    expect(onKeystroke).toHaveBeenCalled();
  });

  it("calls onSendMessage and clears input on Enter", async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const onStopTyping = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={onSendMessage}
        onKeystroke={vi.fn()}
        onStopTyping={onStopTyping}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "Hello{Enter}");
    expect(onSendMessage).toHaveBeenCalledWith("Hello", undefined);
    expect(onStopTyping).toHaveBeenCalled();
  });

  it("does not send on Shift+Enter", async () => {
    const onSendMessage = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={onSendMessage}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Hello{Shift>}{Enter}{/Shift}"
    );
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("disables input when disabled prop is true", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        disabled={true}
      />
    );
    expect(
      screen.getByPlaceholderText("Type a message...")
    ).toBeDisabled();
  });

  it("shows verification prompt when phone not verified", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        phoneVerified={false}
      />
    );
    expect(screen.getByText("Verify your phone number")).toBeInTheDocument();
    expect(screen.getByText(/to send messages/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Type a message...")).not.toBeInTheDocument();
  });

  it("shows input when phone is verified", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        phoneVerified={true}
      />
    );
    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
    expect(screen.queryByText("Verify your phone number")).not.toBeInTheDocument();
  });

  // Up-arrow edit tests
  it("calls onEditLastMessage when pressing ArrowUp with empty input", async () => {
    const onEditLastMessage = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        onEditLastMessage={onEditLastMessage}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(onEditLastMessage).toHaveBeenCalledTimes(1);
  });

  it("does not call onEditLastMessage when pressing ArrowUp with text in input", async () => {
    const onEditLastMessage = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        onEditLastMessage={onEditLastMessage}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.type(input, "some text");
    await user.keyboard("{ArrowUp}");
    expect(onEditLastMessage).not.toHaveBeenCalled();
  });

  it("does not call onEditLastMessage when callback is not provided", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    await user.click(input);
    // Should not throw when pressing ArrowUp without the callback
    await user.keyboard("{ArrowUp}");
  });

  // File attach and voice recorder tests
  it("renders attach file button", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Attach file")).toBeInTheDocument();
  });

  it("renders voice record button when input is empty", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    expect(screen.getByTestId("voice-record-button")).toBeInTheDocument();
  });

  it("hides voice button when text is entered", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    expect(screen.getByTestId("voice-record-button")).toBeInTheDocument();
    expect(screen.queryByLabelText("Send message")).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Hello"
    );

    expect(screen.queryByTestId("voice-record-button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("shows voice recorder when mic button clicked", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("voice-record-button"));
    expect(screen.getByTestId("voice-recorder")).toBeInTheDocument();
  });

  // Reply preview tests
  const replySender: ChatUserProfile = {
    id: "sender2",
    username: "bob",
    displayName: "Bob",
    name: "Bob Jones",
    avatar: null,
    image: null,
  };

  const replyMessage: MessageData = {
    id: "reply-msg-1",
    conversationId: "conv1",
    senderId: "sender2",
    content: "This is the message being replied to",
    mediaUrl: null,
    mediaType: null,
    mediaFileName: null,
    mediaFileSize: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date("2024-01-01"),
    sender: replySender,
    reactions: [],
    replyTo: null,
  };

  it("shows reply preview bar when replyingTo is set", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={replyMessage}
        onCancelReply={vi.fn()}
      />
    );
    expect(screen.getByTestId("reply-preview")).toBeInTheDocument();
  });

  it("shows sender name in reply preview", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={replyMessage}
        onCancelReply={vi.fn()}
      />
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows truncated content in reply preview", () => {
    const longMessage: MessageData = {
      ...replyMessage,
      content: "B".repeat(150),
    };
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={longMessage}
        onCancelReply={vi.fn()}
      />
    );
    expect(screen.getByText("B".repeat(100) + "...")).toBeInTheDocument();
  });

  it("shows cancel reply button", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={replyMessage}
        onCancelReply={vi.fn()}
      />
    );
    expect(screen.getByTestId("cancel-reply")).toBeInTheDocument();
  });

  it("calls onCancelReply when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancelReply = vi.fn();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={replyMessage}
        onCancelReply={onCancelReply}
      />
    );
    await user.click(screen.getByTestId("cancel-reply"));
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it("does not show reply preview when replyingTo is null", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
      />
    );
    expect(screen.queryByTestId("reply-preview")).not.toBeInTheDocument();
  });

  it("focuses textarea when replyingTo is set", () => {
    const { rerender } = render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={null}
        onCancelReply={vi.fn()}
      />
    );

    rerender(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        replyingTo={replyMessage}
        onCancelReply={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Type a message...");
    expect(document.activeElement).toBe(textarea);
  });
});
