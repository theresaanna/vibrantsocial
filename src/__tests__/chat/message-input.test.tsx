import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "@/components/chat/message-input";
import type { MessageData, ChatUserProfile } from "@/types/chat";

// Mock URL.createObjectURL for image preview tests
URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();

const mockUseSession = vi.fn().mockReturnValue({ data: null, status: "unauthenticated" });
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@/components/chat/voice-recorder", () => ({
  VoiceRecorder: ({ onRecordingComplete, onCancel, maxDuration }: { onRecordingComplete: (blob: Blob) => void; onCancel: () => void; maxDuration?: number }) => (
    <div data-testid="voice-recorder" data-max-duration={maxDuration}>
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

  // File limits hint
  it("displays file size limits hint when file is attached", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    // Hint only shows when there's media attached
    expect(screen.queryByTestId("chat-file-limits")).not.toBeInTheDocument();

    const fileInput = screen.getByTestId("file-input");
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    const hint = screen.getByTestId("chat-file-limits");
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain("Images");
    expect(hint.textContent).toContain("Videos");
    expect(hint.textContent).toContain("Audio");
    expect(hint.textContent).toContain("PDF");
  });

  it("does not show file limits hint when phone not verified", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
        phoneVerified={false}
      />
    );
    expect(screen.queryByTestId("chat-file-limits")).not.toBeInTheDocument();
  });

  // Multiple file selection tests
  it("file input has multiple attribute", () => {
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );
    const fileInput = screen.getByTestId("file-input");
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("shows preview for a single selected file", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    expect(screen.getByTestId("file-preview")).toBeInTheDocument();
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
  });

  it("shows previews for multiple selected files", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file1 = new File(["content1"], "photo.png", { type: "image/png" });
    const file2 = new File(["content2"], "doc.pdf", { type: "application/pdf" });
    await user.upload(fileInput, [file1, file2]);

    const previews = screen.getAllByTestId("file-preview");
    expect(previews).toHaveLength(2);
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
  });

  it("allows removing individual files from multi-select", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file1 = new File(["content1"], "photo.png", { type: "image/png" });
    const file2 = new File(["content2"], "doc.pdf", { type: "application/pdf" });
    await user.upload(fileInput, [file1, file2]);

    expect(screen.getAllByTestId("file-preview")).toHaveLength(2);

    // Remove the first file
    const removeButtons = screen.getAllByTestId("remove-attachment");
    await user.click(removeButtons[0]);

    expect(screen.getAllByTestId("file-preview")).toHaveLength(1);
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
  });

  it("can add more files to existing selection", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");

    // Select first file
    const file1 = new File(["content1"], "photo.png", { type: "image/png" });
    await user.upload(fileInput, file1);
    expect(screen.getAllByTestId("file-preview")).toHaveLength(1);

    // Select another file - should add to existing
    const file2 = new File(["content2"], "doc.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file2);
    expect(screen.getAllByTestId("file-preview")).toHaveLength(2);
  });

  it("shows send button when files are selected without text", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-record-button")).not.toBeInTheDocument();
  });

  it("clears all files after sending", async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    // Mock successful upload
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://example.com/file.pdf", fileType: "application/pdf", fileName: "test.pdf", fileSize: 100 }),
    });

    render(
      <MessageInput
        onSendMessage={onSendMessage}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file1 = new File(["content1"], "file1.pdf", { type: "application/pdf" });
    const file2 = new File(["content2"], "file2.pdf", { type: "application/pdf" });
    await user.upload(fileInput, [file1, file2]);

    expect(screen.getAllByTestId("file-preview")).toHaveLength(2);

    // Type text and send
    await user.type(screen.getByPlaceholderText("Type a message..."), "Here are the files");
    await user.click(screen.getByLabelText("Send message"));

    // Wait for send to complete
    await vi.waitFor(() => {
      expect(onSendMessage).toHaveBeenCalled();
    });

    // Files should be cleared after send
    await vi.waitFor(() => {
      expect(screen.queryByTestId("file-preview")).not.toBeInTheDocument();
    });

    // Restore fetch
    vi.restoreAllMocks();
  });

  it("shows premium tier sizes in file limits hint for premium users", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", tier: "premium" } },
      status: "authenticated",
    });

    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);

    const hint = screen.getByTestId("chat-file-limits");
    expect(hint.textContent).toContain("20MB");
    expect(hint.textContent).toContain("200MB");
    expect(hint.textContent).toContain("50MB");

    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
  });

  it("passes premium maxDuration to VoiceRecorder for premium users", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", tier: "premium" } },
      status: "authenticated",
    });

    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("voice-record-button"));
    const recorder = screen.getByTestId("voice-recorder");
    expect(recorder).toHaveAttribute("data-max-duration", "120");

    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
  });

  it("passes free tier maxDuration to VoiceRecorder by default", async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSendMessage={vi.fn()}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("voice-record-button"));
    const recorder = screen.getByTestId("voice-recorder");
    expect(recorder).toHaveAttribute("data-max-duration", "20");
  });

  it("sends multiple media attachments as array", async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    let uploadCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      uploadCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          url: `https://example.com/file${uploadCount}.pdf`,
          fileType: "application/pdf",
          fileName: `file${uploadCount}.pdf`,
          fileSize: 100,
        }),
      });
    });

    render(
      <MessageInput
        onSendMessage={onSendMessage}
        onKeystroke={vi.fn()}
        onStopTyping={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId("file-input");
    const file1 = new File(["content1"], "file1.pdf", { type: "application/pdf" });
    const file2 = new File(["content2"], "file2.pdf", { type: "application/pdf" });
    await user.upload(fileInput, [file1, file2]);

    await user.type(screen.getByPlaceholderText("Type a message..."), "Files");
    await user.click(screen.getByLabelText("Send message"));

    await vi.waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith("Files", [
        expect.objectContaining({ url: "https://example.com/file1.pdf" }),
        expect.objectContaining({ url: "https://example.com/file2.pdf" }),
      ]);
    });

    vi.restoreAllMocks();
  });
});
