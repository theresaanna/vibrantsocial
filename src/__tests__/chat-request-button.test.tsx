import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/messages/actions", () => ({
  sendChatRequest: vi.fn(),
  cancelChatRequest: vi.fn(),
}));

import { ChatRequestButton } from "@/components/chat-request-button";
import { sendChatRequest, cancelChatRequest } from "@/app/messages/actions";

const mockSendChatRequest = vi.mocked(sendChatRequest);
const mockCancelChatRequest = vi.mocked(cancelChatRequest);

describe("ChatRequestButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with chat request label when status is none", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="none" />);
    const button = screen.getByTestId("chat-request-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Chat Request");
  });

  it("renders with chat requested label when status is pending", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="pending" />);
    const button = screen.getByTestId("chat-request-button");
    expect(button).toHaveTextContent("Chat Requested");
    expect(button).not.toBeDisabled();
  });

  it("does not render when status is friends", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="friends" />);
    expect(screen.queryByTestId("chat-request-button")).not.toBeInTheDocument();
  });

  it("does not render when status is has_conversation", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="has_conversation" />);
    expect(screen.queryByTestId("chat-request-button")).not.toBeInTheDocument();
  });

  it("does not render when status is accepted", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="accepted" />);
    expect(screen.queryByTestId("chat-request-button")).not.toBeInTheDocument();
  });

  it("renders when status is declined (allows re-requesting)", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="declined" />);
    const button = screen.getByTestId("chat-request-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Chat Request");
    expect(button).not.toBeDisabled();
  });

  it("sends chat request and updates to pending on success", async () => {
    mockSendChatRequest.mockResolvedValue({
      success: true,
      message: "Chat request sent",
    });

    render(<ChatRequestButton userId="user-123" initialStatus="none" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    await waitFor(() => {
      expect(mockSendChatRequest).toHaveBeenCalledWith("user-123");
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Requested");
    });
  });

  it("shows sending loading state", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockSendChatRequest.mockReturnValue(promise as ReturnType<typeof sendChatRequest>);

    render(<ChatRequestButton userId="user-123" initialStatus="none" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Sending…");
    expect(screen.getByTestId("chat-request-button")).toBeDisabled();

    resolvePromise!({ success: true, message: "Chat request sent" });

    await waitFor(() => {
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Requested");
    });
  });

  it("shows error message when send fails", async () => {
    mockSendChatRequest.mockResolvedValue({
      success: false,
      message: "Too many chat requests. Please try again later.",
    });

    render(<ChatRequestButton userId="user-123" initialStatus="none" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-request-error")).toHaveTextContent(
        "Too many chat requests. Please try again later."
      );
    });

    // Button should still show "Chat Request" (not updated to pending)
    expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Request");
  });

  it("applies custom theme styles when hasCustomTheme is true", () => {
    render(<ChatRequestButton userId="user-123" initialStatus="none" hasCustomTheme />);
    const button = screen.getByTestId("chat-request-button");
    expect(button.style.borderColor).toBe("var(--profile-secondary)");
    expect(button.style.color).toBe("var(--profile-text)");
  });

  // Cancel flow tests
  it("cancels pending chat request on click and reverts to none", async () => {
    mockCancelChatRequest.mockResolvedValue({
      success: true,
      message: "Chat request cancelled",
    });

    render(<ChatRequestButton userId="user-123" initialStatus="pending" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    await waitFor(() => {
      expect(mockCancelChatRequest).toHaveBeenCalledWith("user-123");
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Request");
    });
  });

  it("shows cancelling loading state", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockCancelChatRequest.mockReturnValue(promise as ReturnType<typeof cancelChatRequest>);

    render(<ChatRequestButton userId="user-123" initialStatus="pending" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Cancelling…");
    expect(screen.getByTestId("chat-request-button")).toBeDisabled();

    resolvePromise!({ success: true, message: "Chat request cancelled" });

    await waitFor(() => {
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Request");
    });
  });

  it("shows error when cancel fails", async () => {
    mockCancelChatRequest.mockResolvedValue({
      success: false,
      message: "No pending chat request to cancel",
    });

    render(<ChatRequestButton userId="user-123" initialStatus="pending" />);
    fireEvent.click(screen.getByTestId("chat-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-request-error")).toHaveTextContent(
        "No pending chat request to cancel"
      );
    });

    // Button should still show "Chat Requested" (not reverted)
    expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Requested");
  });

  it("can send after cancelling (full round-trip)", async () => {
    mockCancelChatRequest.mockResolvedValue({
      success: true,
      message: "Chat request cancelled",
    });
    mockSendChatRequest.mockResolvedValue({
      success: true,
      message: "Chat request sent",
    });

    render(<ChatRequestButton userId="user-123" initialStatus="pending" />);

    // Cancel
    fireEvent.click(screen.getByTestId("chat-request-button"));
    await waitFor(() => {
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Request");
    });

    // Re-send
    fireEvent.click(screen.getByTestId("chat-request-button"));
    await waitFor(() => {
      expect(mockSendChatRequest).toHaveBeenCalledWith("user-123");
      expect(screen.getByTestId("chat-request-button")).toHaveTextContent("Chat Requested");
    });
  });
});
