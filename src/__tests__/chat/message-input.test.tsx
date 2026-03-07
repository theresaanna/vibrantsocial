import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "@/components/chat/message-input";

describe("MessageInput", () => {
  it("renders input and send button", () => {
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
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Send message")).toBeDisabled();
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
    expect(onSendMessage).toHaveBeenCalledWith("Hello");
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
});
