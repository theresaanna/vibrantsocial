import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostAuthorProvider } from "@/components/editor/PostAuthorContext";

// Mock poll actions
const mockVotePoll = vi.fn();
const mockGetPollVotes = vi.fn();
vi.mock("@/app/feed/poll-actions", () => ({
  votePoll: (...args: unknown[]) => mockVotePoll(...args),
  getPollVotes: (...args: unknown[]) => mockGetPollVotes(...args),
}));

// Mock Ably
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockConnect = vi.fn();
vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: () => ({
    connection: { state: "initialized" },
    connect: mockConnect,
    channels: {
      get: () => ({
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
      }),
    },
  }),
}));

// Mock Lexical
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [{
    update: (fn: () => void) => fn(),
  }],
}));
vi.mock("lexical", async () => {
  const actual = await vi.importActual("lexical");
  return {
    ...actual,
    $getNodeByKey: () => null,
  };
});

import { PollComponent } from "@/components/editor/nodes/PollNode";

const defaultOptions = [
  { id: "opt-1", text: "Option A", votes: 0 },
  { id: "opt-2", text: "Option B", votes: 0 },
];

function renderPoll(overrides: {
  isPostAuthor?: boolean;
  postId?: string | null;
  currentUserId?: string | null;
  options?: typeof defaultOptions;
  expiresAt?: string | null;
} = {}) {
  const {
    isPostAuthor = false,
    postId = "post-1",
    currentUserId = "user-1",
    options = defaultOptions,
    expiresAt = null,
  } = overrides;

  return render(
    <PostAuthorProvider isPostAuthor={isPostAuthor} postId={postId} currentUserId={currentUserId}>
      <PollComponent
        question="Best color?"
        options={options}
        expiresAt={expiresAt}
        nodeKey="test-key"
      />
    </PostAuthorProvider>
  );
}

describe("PollComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPollVotes.mockResolvedValue({ votes: {}, userVote: null });
  });

  it("fetches persisted votes on mount", async () => {
    mockGetPollVotes.mockResolvedValue({
      votes: { "opt-1": 3, "opt-2": 1 },
      userVote: null,
    });

    renderPoll();

    await waitFor(() => {
      expect(mockGetPollVotes).toHaveBeenCalledWith("post-1");
    });
  });

  it("shows the question text", async () => {
    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Best color?")).toBeInTheDocument();
    });
  });

  it("shows option text", async () => {
    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
      expect(screen.getByText("Option B")).toBeInTheDocument();
    });
  });

  it("shows voting buttons when user has not voted", async () => {
    renderPoll();
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).not.toBeDisabled();
    });
  });

  it("calls votePoll server action when user votes", async () => {
    mockVotePoll.mockResolvedValue({ votes: { "opt-1": 1, "opt-2": 0 }, userVote: "opt-1" });

    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Option A"));

    await waitFor(() => {
      expect(mockVotePoll).toHaveBeenCalledWith("post-1", "opt-1");
    });
  });

  it("shows results after voting", async () => {
    mockVotePoll.mockResolvedValue({ votes: { "opt-1": 1, "opt-2": 0 }, userVote: "opt-1" });

    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Option A"));

    await waitFor(() => {
      expect(screen.getByText("1 vote")).toBeInTheDocument();
    });
  });

  it("shows results to post author without voting", async () => {
    mockGetPollVotes.mockResolvedValue({
      votes: { "opt-1": 5, "opt-2": 3 },
      userVote: null,
    });

    renderPoll({ isPostAuthor: true });

    await waitFor(() => {
      expect(screen.getByText("8 votes")).toBeInTheDocument();
    });

    // Buttons should be disabled for author
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows user's existing vote on mount", async () => {
    mockGetPollVotes.mockResolvedValue({
      votes: { "opt-1": 2, "opt-2": 5 },
      userVote: "opt-2",
    });

    renderPoll();

    await waitFor(() => {
      expect(screen.getByText("7 votes")).toBeInTheDocument();
    });

    // Buttons should be disabled since user already voted
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disables buttons for expired polls", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();

    renderPoll({ expiresAt: pastDate });

    await waitFor(() => {
      expect(screen.getByText("Poll ended")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("subscribes to Ably channel for real-time updates", async () => {
    renderPoll();

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledWith("vote", expect.any(Function));
    });
  });

  it("updates vote counts when receiving Ably message", async () => {
    mockGetPollVotes.mockResolvedValue({
      votes: { "opt-1": 1, "opt-2": 0 },
      userVote: "opt-1",
    });

    renderPoll();

    await waitFor(() => {
      expect(screen.getByText("1 vote")).toBeInTheDocument();
    });

    // Simulate Ably message
    const handler = mockSubscribe.mock.calls[0][1];
    act(() => {
      handler({
        data: {
          votes: { "opt-1": 3, "opt-2": 2 },
          voterId: "other-user",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("5 votes")).toBeInTheDocument();
    });
  });

  it("unsubscribes from Ably on unmount", async () => {
    const { unmount } = renderPoll();

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledWith("vote", expect.any(Function));
  });

  it("does not call server actions when postId is null (editor preview)", async () => {
    renderPoll({ postId: null });

    // Wait a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetPollVotes).not.toHaveBeenCalled();
  });

  it("does not allow voting when not authenticated", async () => {
    renderPoll({ currentUserId: null });

    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Option A"));

    expect(mockVotePoll).not.toHaveBeenCalled();
  });

  it("reverts optimistic update on server error", async () => {
    mockVotePoll.mockRejectedValue(new Error("Server error"));
    mockGetPollVotes.mockResolvedValue({
      votes: { "opt-1": 0, "opt-2": 0 },
      userVote: null,
    });

    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Option A"));

    // After the error, the optimistic vote should be reverted
    await waitFor(() => {
      // Buttons should be enabled again since vote was reverted
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).not.toBeDisabled();
    });
  });

  it("shows loading skeleton while fetching persisted votes", () => {
    // Make getPollVotes hang
    mockGetPollVotes.mockReturnValue(new Promise(() => {}));

    renderPoll();

    // Should show skeleton (animated pulse divs), not option buttons
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("prevents double voting by disabling buttons while vote is in flight", async () => {
    let resolveVote!: (v: unknown) => void;
    mockVotePoll.mockReturnValue(new Promise((r) => { resolveVote = r; }));

    renderPoll();
    await waitFor(() => {
      expect(screen.getByText("Option A")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Option A"));

    // Buttons should be disabled while vote is in flight
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => expect(btn).toBeDisabled());
    });

    // Resolve the vote
    act(() => {
      resolveVote({ votes: { "opt-1": 1, "opt-2": 0 }, userVote: "opt-1" });
    });
  });

  it("shows time remaining for active polls", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // +24h
    renderPoll({ expiresAt: futureDate });

    await waitFor(() => {
      // Should show hours remaining
      expect(screen.getByText(/remaining/)).toBeInTheDocument();
    });
  });
});
