import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/chat/actions", () => ({
  startConversation: vi.fn(),
}));

import { MessageButton } from "@/components/message-button";
import { startConversation } from "@/app/chat/actions";

const mockStartConversation = vi.mocked(startConversation);

describe("MessageButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with message icon and label", () => {
    render(<MessageButton userId="user-123" />);
    const button = screen.getByTestId("message-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Message");
  });

  it("starts conversation and navigates to chat on click", async () => {
    mockStartConversation.mockResolvedValue({
      success: true,
      message: "Conversation created",
      conversationId: "conv-456",
    });

    render(<MessageButton userId="user-123" />);
    fireEvent.click(screen.getByTestId("message-button"));

    await waitFor(() => {
      expect(mockStartConversation).toHaveBeenCalledWith("user-123");
      expect(mockPush).toHaveBeenCalledWith("/chat/conv-456");
    });
  });

  it("shows loading state while pending", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockStartConversation.mockReturnValue(promise as ReturnType<typeof startConversation>);

    render(<MessageButton userId="user-123" />);
    fireEvent.click(screen.getByTestId("message-button"));

    expect(screen.getByTestId("message-button")).toHaveTextContent("Opening…");
    expect(screen.getByTestId("message-button")).toBeDisabled();

    resolvePromise!({
      success: true,
      message: "ok",
      conversationId: "conv-789",
    });

    await waitFor(() => {
      expect(screen.getByTestId("message-button")).toHaveTextContent("Message");
    });
  });

  it("does not navigate if startConversation fails", async () => {
    mockStartConversation.mockResolvedValue({
      success: false,
      message: "User not found",
    });

    render(<MessageButton userId="user-123" />);
    fireEvent.click(screen.getByTestId("message-button"));

    await waitFor(() => {
      expect(mockStartConversation).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("applies custom theme styles when hasCustomTheme is true", () => {
    render(<MessageButton userId="user-123" hasCustomTheme />);
    const button = screen.getByTestId("message-button");
    expect(button.style.borderColor).toBe("var(--profile-secondary)");
    expect(button.style.color).toBe("var(--profile-text)");
  });
});
