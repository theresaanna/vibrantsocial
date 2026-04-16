import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/feed/block-actions", () => ({
  toggleBlock: vi.fn(() => Promise.resolve({ success: true, message: "Blocked" })),
}));

vi.mock("@/app/messages/actions", () => ({
  dismissChatAbuseAlerts: vi.fn(() => Promise.resolve({ success: true, message: "Dismissed" })),
}));

vi.mock("@/components/report-modal", () => ({
  ReportModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="report-modal">
      <button onClick={onClose}>Close Report</button>
    </div>
  ),
}));

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm Block</button>
        <button onClick={onCancel}>Cancel Block</button>
      </div>
    ) : null,
}));

import { ChatAbuseNotificationActions } from "@/components/chat-abuse-notification-actions";
import { dismissChatAbuseAlerts } from "@/app/messages/actions";

describe("ChatAbuseNotificationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Report, Block, and Dismiss buttons", () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId="conv1" />
    );
    expect(screen.getByText("Report")).toBeInTheDocument();
    expect(screen.getByText("Block")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("opens report modal when Report clicked", () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId="conv1" />
    );
    fireEvent.click(screen.getByText("Report"));
    expect(screen.getByTestId("report-modal")).toBeInTheDocument();
  });

  it("opens block confirmation when Block clicked", () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId="conv1" />
    );
    fireEvent.click(screen.getByText("Block"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
  });

  it("calls dismissChatAbuseAlerts when Dismiss clicked", async () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId="conv1" />
    );
    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(dismissChatAbuseAlerts).toHaveBeenCalledWith("abuser1");
    });
    expect(screen.getByText("Future alerts from this user dismissed.")).toBeInTheDocument();
  });

  it("shows blocked confirmation after blocking", async () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId="conv1" />
    );
    fireEvent.click(screen.getByText("Block"));
    fireEvent.click(screen.getByText("Confirm Block"));

    await waitFor(() => {
      expect(screen.getByText("User blocked.")).toBeInTheDocument();
    });
  });

  it("does not render report modal when conversationId is null", () => {
    render(
      <ChatAbuseNotificationActions actorId="abuser1" conversationId={null} />
    );
    fireEvent.click(screen.getByText("Report"));
    expect(screen.queryByTestId("report-modal")).not.toBeInTheDocument();
  });
});
