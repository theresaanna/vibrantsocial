import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockBulkDeclineMessageRequests = vi.fn();

vi.mock("@/app/messages/actions", () => ({
  bulkDeclineMessageRequests: (...args: unknown[]) =>
    mockBulkDeclineMessageRequests(...args),
}));

vi.mock("@/components/chat/message-request-card", () => ({
  MessageRequestCard: ({
    request,
    selectMode,
    isSelected,
    onToggleSelect,
  }: {
    request: { id: string; sender: { displayName: string | null } };
    selectMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
  }) => (
    <div data-testid={`request-${request.id}`}>
      <span>{request.sender.displayName}</span>
      {selectMode && (
        <input
          type="checkbox"
          data-testid={`select-${request.id}`}
          checked={isSelected}
          onChange={() => onToggleSelect(request.id)}
        />
      )}
    </div>
  ),
}));

import { MessageRequestList } from "@/components/chat/message-request-list";
import type { MessageRequestData } from "@/types/chat";

const makeSender = (id: string, username: string, displayName: string) => ({
  id,
  username,
  displayName,
  name: displayName,
  avatar: null,
  image: null,
  profileFrameId: null,
});

const makeRequest = (
  id: string,
  senderId: string,
  senderUsername: string,
  senderDisplayName: string
): MessageRequestData => ({
  id,
  senderId,
  status: "PENDING",
  createdAt: new Date(),
  sender: makeSender(senderId, senderUsername, senderDisplayName),
});

describe("MessageRequestList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Empty state ───────────────────────────────────────────

  it("renders nothing when no requests", () => {
    const { container } = render(<MessageRequestList requests={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // ─── With requests ────────────────────────────────────────

  it("shows 'Message Requests' header with count badge", () => {
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<MessageRequestList requests={requests} />);
    expect(screen.getByText("Message Requests")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders request cards with sender names", () => {
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<MessageRequestList requests={requests} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  // ─── Expand/collapse ──────────────────────────────────────

  it("is expanded by default", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);
    expect(screen.getByTestId("request-r1")).toBeInTheDocument();
  });

  it("collapses when header is clicked", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Message Requests"));
    expect(screen.queryByTestId("request-r1")).not.toBeInTheDocument();
  });

  it("expands again when header is clicked twice", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Message Requests"));
    expect(screen.queryByTestId("request-r1")).not.toBeInTheDocument();

    await user.click(screen.getByText("Message Requests"));
    expect(screen.getByTestId("request-r1")).toBeInTheDocument();
  });

  // ─── Select mode with bulk decline ─────────────────────────

  it("shows Select button when expanded", () => {
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("enters select mode showing Select all and Cancel", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));

    expect(screen.getByText("Select all")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows checkboxes on request cards in select mode", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));
    expect(screen.getByTestId("select-r1")).toBeInTheDocument();
  });

  it("shows delete button with count when items are selected", async () => {
    const user = userEvent.setup();
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));
    await user.click(screen.getByTestId("select-r1"));

    expect(screen.getByText("Delete (1)")).toBeInTheDocument();
  });

  it("does not show delete button when no items are selected", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it("selects all when Select all is checked", async () => {
    const user = userEvent.setup();
    const requests = [
      makeRequest("r1", "s1", "alice", "Alice"),
      makeRequest("r2", "s2", "bob", "Bob"),
    ];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));
    await user.click(screen.getByLabelText("Select all"));

    expect((screen.getByTestId("select-r1") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("select-r2") as HTMLInputElement).checked).toBe(true);
  });

  it("exits select mode when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const requests = [makeRequest("r1", "s1", "alice", "Alice")];
    render(<MessageRequestList requests={requests} />);

    await user.click(screen.getByText("Select"));
    expect(screen.getByText("Select all")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });
});
