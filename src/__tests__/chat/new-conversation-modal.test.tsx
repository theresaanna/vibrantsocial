import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockStartConversation = vi.fn();
const mockCreateGroupConversation = vi.fn();

vi.mock("@/app/messages/actions", () => ({
  startConversation: (...args: unknown[]) => mockStartConversation(...args),
  createGroupConversation: (...args: unknown[]) =>
    mockCreateGroupConversation(...args),
}));

vi.mock("@/components/chat/user-search", () => ({
  UserSearch: ({
    onSelect,
    placeholder,
  }: {
    onSelect: (user: {
      id: string;
      username: string;
      displayName: string;
      name: string;
    }) => void;
    placeholder?: string;
    excludeIds?: string[];
  }) => (
    <div data-testid="user-search">
      <input data-testid="user-search-input" placeholder={placeholder} />
      <button
        data-testid="select-alice"
        onClick={() =>
          onSelect({
            id: "alice-id",
            username: "alice",
            displayName: "Alice",
            name: "Alice",
          })
        }
      >
        Select Alice
      </button>
      <button
        data-testid="select-bob"
        onClick={() =>
          onSelect({
            id: "bob-id",
            username: "bob",
            displayName: "Bob",
            name: "Bob",
          })
        }
      >
        Select Bob
      </button>
      <button
        data-testid="select-charlie"
        onClick={() =>
          onSelect({
            id: "charlie-id",
            username: "charlie",
            displayName: "Charlie",
            name: "Charlie",
          })
        }
      >
        Select Charlie
      </button>
    </div>
  ),
}));

import { NewConversationModal } from "@/components/chat/new-conversation-modal";

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("NewConversationModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Rendering ────────────────────────────────────────────

  it("renders New Conversation heading", () => {
    render(<NewConversationModal onClose={onClose} />);
    expect(screen.getByText("New Conversation")).toBeInTheDocument();
  });

  it("renders Direct Message and Group Chat tabs", () => {
    render(<NewConversationModal onClose={onClose} />);
    expect(screen.getByText("Direct Message")).toBeInTheDocument();
    expect(screen.getByText("Group Chat")).toBeInTheDocument();
  });

  it("shows Direct Message tab by default", () => {
    render(<NewConversationModal onClose={onClose} />);
    // Direct Message tab should have active styling
    const dmTab = screen.getByText("Direct Message");
    expect(dmTab.className).toContain("bg-zinc-900");
  });

  it("renders user search in direct message mode", () => {
    render(<NewConversationModal onClose={onClose} />);
    expect(screen.getByTestId("user-search")).toBeInTheDocument();
  });

  // ─── Close button ─────────────────────────────────────────

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    // The first fixed div is the backdrop
    const backdrop = document.querySelector(".bg-black\\/50");
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  // ─── Direct message ───────────────────────────────────────

  it("starts conversation when user is selected in direct mode", async () => {
    mockStartConversation.mockResolvedValue({
      success: true,
      conversationId: "conv-new",
      message: "",
    });
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await act(async () => {
      await user.click(screen.getByTestId("select-alice"));
    });

    expect(mockStartConversation).toHaveBeenCalledWith("alice-id");
    expect(mockRouter.push).toHaveBeenCalledWith("/messages/conv-new");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows status message when direct conversation fails", async () => {
    mockStartConversation.mockResolvedValue({
      success: false,
      message: "User blocked you",
    });
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await act(async () => {
      await user.click(screen.getByTestId("select-alice"));
    });

    expect(screen.getByText("User blocked you")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // ─── Group chat tab ───────────────────────────────────────

  it("switches to group chat tab", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));

    expect(
      screen.getByPlaceholderText("Group name")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create group/i })
    ).toBeInTheDocument();
  });

  it("Create Group button is disabled initially", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));

    expect(
      screen.getByRole("button", { name: /create group/i })
    ).toBeDisabled();
  });

  it("shows selected users as chips", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("removes user chip when x button is clicked", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    // Both users should be displayed
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Remove Alice by clicking the x next to the chip
    const aliceChip = screen.getByText("Alice").closest("span");
    const removeBtn = aliceChip?.querySelector("button");
    if (removeBtn) {
      await user.click(removeBtn);
    }

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("does not add duplicate users", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-alice")); // duplicate

    // Should only appear once
    const aliceTexts = screen.getAllByText("Alice");
    expect(aliceTexts.length).toBe(1);
  });

  it("enables Create Group when name and 2+ users are set", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.type(screen.getByPlaceholderText("Group name"), "My Group");
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    expect(
      screen.getByRole("button", { name: /create group/i })
    ).not.toBeDisabled();
  });

  it("keeps Create Group disabled with name but only 1 user", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.type(screen.getByPlaceholderText("Group name"), "My Group");
    await user.click(screen.getByTestId("select-alice"));

    expect(
      screen.getByRole("button", { name: /create group/i })
    ).toBeDisabled();
  });

  it("keeps Create Group disabled without name but 2+ users", async () => {
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    expect(
      screen.getByRole("button", { name: /create group/i })
    ).toBeDisabled();
  });

  it("creates group conversation", async () => {
    mockCreateGroupConversation.mockResolvedValue({
      success: true,
      conversationId: "group-new",
      message: "",
    });
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.type(screen.getByPlaceholderText("Group name"), "Team");
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /create group/i })
      );
    });

    expect(mockCreateGroupConversation).toHaveBeenCalledWith({
      name: "Team",
      participantIds: ["alice-id", "bob-id"],
    });
    expect(mockRouter.push).toHaveBeenCalledWith("/messages/group-new");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error when group creation fails", async () => {
    mockCreateGroupConversation.mockResolvedValue({
      success: false,
      message: "Group creation failed",
    });
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    await user.click(screen.getByText("Group Chat"));
    await user.type(screen.getByPlaceholderText("Group name"), "Team");
    await user.click(screen.getByTestId("select-alice"));
    await user.click(screen.getByTestId("select-bob"));

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /create group/i })
      );
    });

    expect(screen.getByText("Group creation failed")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows loading state when creating conversation", async () => {
    // Make startConversation hang for a bit
    let resolveStart!: (value: unknown) => void;
    mockStartConversation.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve;
      })
    );
    const user = userEvent.setup();
    render(<NewConversationModal onClose={onClose} />);

    // Don't await
    act(() => {
      user.click(screen.getByTestId("select-alice"));
    });

    // Wait for the loading text to appear
    await screen.findByText("Starting conversation...");

    // Resolve the promise
    await act(async () => {
      resolveStart({
        success: true,
        conversationId: "conv-new",
        message: "",
      });
    });
  });
});
