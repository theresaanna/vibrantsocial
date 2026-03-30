import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/chat/actions", () => ({
  respondToChatRequestByActor: vi.fn(),
}));

import { ChatRequestNotificationActions } from "@/components/chat-request-notification-actions";
import { respondToChatRequestByActor } from "@/app/chat/actions";

const mockRespond = vi.mocked(respondToChatRequestByActor);

describe("ChatRequestNotificationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders accept and decline buttons", () => {
    render(<ChatRequestNotificationActions actorId="actor-1" />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("shows Accepted text after accepting", async () => {
    mockRespond.mockResolvedValue({
      success: true,
      message: "Chat request accepted",
      conversationId: "conv-123",
    });

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith("actor-1", "accept");
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });
  });

  it("navigates to chat on accept", async () => {
    mockRespond.mockResolvedValue({
      success: true,
      message: "Chat request accepted",
      conversationId: "conv-123",
    });

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/chat/conv-123");
    });
  });

  it("shows Declined text after declining", async () => {
    mockRespond.mockResolvedValue({
      success: true,
      message: "Chat request declined",
    });

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Decline"));

    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith("actor-1", "decline");
      expect(screen.getByText("Declined")).toBeInTheDocument();
    });
  });

  it("does not navigate on decline", async () => {
    mockRespond.mockResolvedValue({
      success: true,
      message: "Chat request declined",
    });

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Decline"));

    await waitFor(() => {
      expect(screen.getByText("Declined")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onRespond callback on success", async () => {
    mockRespond.mockResolvedValue({
      success: true,
      message: "Chat request accepted",
      conversationId: "conv-123",
    });

    const onRespond = vi.fn();
    render(<ChatRequestNotificationActions actorId="actor-1" onRespond={onRespond} />);
    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(onRespond).toHaveBeenCalled();
    });
  });

  it("does not update state when action fails", async () => {
    mockRespond.mockResolvedValue({
      success: false,
      message: "No pending chat request found",
    });

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(mockRespond).toHaveBeenCalledWith("actor-1", "accept");
    });

    // Buttons should still be visible (not replaced with Accepted/Declined text)
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("disables buttons while pending", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockRespond.mockReturnValue(promise as ReturnType<typeof respondToChatRequestByActor>);

    render(<ChatRequestNotificationActions actorId="actor-1" />);
    fireEvent.click(screen.getByText("Accept"));

    // Both buttons should show "..." or be disabled
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    resolvePromise!({ success: true, message: "ok", conversationId: "c-1" });

    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });
  });
});
