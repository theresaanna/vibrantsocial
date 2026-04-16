import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUpdateGroupName = vi.fn();
const mockAddGroupMembers = vi.fn();
const mockRemoveGroupMember = vi.fn();

vi.mock("@/app/messages/actions", () => ({
  updateGroupName: (...args: unknown[]) => mockUpdateGroupName(...args),
  addGroupMembers: (...args: unknown[]) => mockAddGroupMembers(...args),
  removeGroupMember: (...args: unknown[]) => mockRemoveGroupMember(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/chat/user-search", () => ({
  UserSearch: ({
    onSelect,
    placeholder,
  }: {
    onSelect: (user: { id: string; username: string; displayName: string }) => void;
    placeholder?: string;
  }) => (
    <div data-testid="user-search">
      <input
        data-testid="user-search-input"
        placeholder={placeholder}
      />
      <button
        data-testid="select-user-btn"
        onClick={() =>
          onSelect({
            id: "new-user-1",
            username: "newuser",
            displayName: "New User",
          })
        }
      >
        Select User
      </button>
    </div>
  ),
}));

import { GroupChatSettings } from "@/components/chat/group-chat-settings";

const makeParticipant = (
  id: string,
  userId: string,
  username: string,
  displayName: string,
  isAdmin: boolean
) => ({
  id,
  userId,
  isAdmin,
  lastReadAt: null,
  user: {
    id: userId,
    username,
    displayName,
    name: displayName,
    avatar: null,
    image: null,
  },
});

const mockConversation = {
  id: "conv1",
  isGroup: true,
  name: "Test Group",
  avatarUrl: null,
  participants: [
    makeParticipant("p1", "user1", "admin", "Admin User", true),
    makeParticipant("p2", "user2", "member", "Member User", false),
    makeParticipant("p3", "user3", "member2", "Member Two", false),
  ],
};

const defaultProps = {
  conversation: mockConversation,
  currentUserId: "user1", // admin
  onClose: vi.fn(),
  onConversationUpdate: vi.fn(),
};

describe("GroupChatSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Rendering ────────────────────────────────────────────

  it("renders Group Info heading", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("Group Info")).toBeInTheDocument();
  });

  it("renders group name", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("Test Group")).toBeInTheDocument();
  });

  it("renders member count", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("renders Members heading", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("Members")).toBeInTheDocument();
  });

  it("renders all participant names", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText(/Admin User/)).toBeInTheDocument();
    expect(screen.getByText(/Member User/)).toBeInTheDocument();
    expect(screen.getByText(/Member Two/)).toBeInTheDocument();
  });

  it("shows (you) label for current user", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("shows Admin badge for admin participants", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  // ─── Close button ─────────────────────────────────────────

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    // Click the backdrop
    const backdrop = screen.getByText("Group Info").closest(".fixed")
      ?.previousSibling;
    if (backdrop) {
      await user.click(backdrop as Element);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  // ─── Admin features ───────────────────────────────────────

  it("shows edit name button for admin", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(
      screen.getByLabelText("Edit group name")
    ).toBeInTheDocument();
  });

  it("does not show edit name button for non-admin", () => {
    render(
      <GroupChatSettings {...defaultProps} currentUserId="user2" />
    );
    expect(
      screen.queryByLabelText("Edit group name")
    ).not.toBeInTheDocument();
  });

  it("shows + Add Members button for admin", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(
      screen.getByText("+ Add Members")
    ).toBeInTheDocument();
  });

  it("does not show + Add Members button for non-admin", () => {
    render(
      <GroupChatSettings {...defaultProps} currentUserId="user2" />
    );
    expect(screen.queryByText("+ Add Members")).not.toBeInTheDocument();
  });

  it("shows remove button for non-admin members when current user is admin", () => {
    render(<GroupChatSettings {...defaultProps} />);
    expect(
      screen.getByLabelText("Remove Member User")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Remove Member Two")
    ).toBeInTheDocument();
  });

  it("does not show remove button for admin members", () => {
    render(<GroupChatSettings {...defaultProps} />);
    // Admin User should not have a remove button
    expect(
      screen.queryByLabelText("Remove Admin User")
    ).not.toBeInTheDocument();
  });

  // ─── Edit group name ──────────────────────────────────────

  it("shows name input when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByLabelText("Edit group name"));

    const input = screen.getByDisplayValue("Test Group");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();
  });

  it("saves group name", async () => {
    mockUpdateGroupName.mockResolvedValue({
      success: true,
      message: "",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByLabelText("Edit group name"));
    const input = screen.getByDisplayValue("Test Group");
    await user.clear(input);
    await user.type(input, "New Name");

    await act(async () => {
      await user.click(screen.getByText("Save"));
    });

    expect(mockUpdateGroupName).toHaveBeenCalledWith({
      conversationId: "conv1",
      name: "New Name",
    });
    expect(defaultProps.onConversationUpdate).toHaveBeenCalled();
  });

  it("shows error when save name fails", async () => {
    mockUpdateGroupName.mockResolvedValue({
      success: false,
      message: "Name too long",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByLabelText("Edit group name"));
    const input = screen.getByDisplayValue("Test Group");
    await user.clear(input);
    await user.type(input, "New Name");

    await act(async () => {
      await user.click(screen.getByText("Save"));
    });

    expect(screen.getByText("Name too long")).toBeInTheDocument();
  });

  it("cancels name editing", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByLabelText("Edit group name"));
    expect(screen.getByDisplayValue("Test Group")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("Test Group")).toBeInTheDocument();
  });

  it("does not save when name is unchanged", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByLabelText("Edit group name"));
    await user.click(screen.getByText("Save"));

    expect(mockUpdateGroupName).not.toHaveBeenCalled();
  });

  // ─── Add members ──────────────────────────────────────────

  it("shows user search when Add Members is clicked", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByText("+ Add Members"));

    expect(screen.getByTestId("user-search")).toBeInTheDocument();
  });

  it("hides user search when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByText("+ Add Members"));
    expect(screen.getByTestId("user-search")).toBeInTheDocument();

    // Click the cancel button inside add members area
    const cancelBtns = screen.getAllByRole("button", { name: /cancel/i });
    await user.click(cancelBtns[cancelBtns.length - 1]);

    expect(screen.queryByTestId("user-search")).not.toBeInTheDocument();
  });

  it("adds a member when user is selected", async () => {
    mockAddGroupMembers.mockResolvedValue({
      success: true,
      message: "",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByText("+ Add Members"));

    await act(async () => {
      await user.click(screen.getByTestId("select-user-btn"));
    });

    expect(mockAddGroupMembers).toHaveBeenCalledWith({
      conversationId: "conv1",
      userIds: ["new-user-1"],
    });
    expect(defaultProps.onConversationUpdate).toHaveBeenCalled();
  });

  it("shows error when adding member fails", async () => {
    mockAddGroupMembers.mockResolvedValue({
      success: false,
      message: "Failed to add member",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await user.click(screen.getByText("+ Add Members"));

    await act(async () => {
      await user.click(screen.getByTestId("select-user-btn"));
    });

    expect(screen.getByText("Failed to add member")).toBeInTheDocument();
  });

  // ─── Remove member ────────────────────────────────────────

  it("removes a member when remove button is clicked", async () => {
    mockRemoveGroupMember.mockResolvedValue({
      success: true,
      message: "",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByLabelText("Remove Member User"));
    });

    expect(mockRemoveGroupMember).toHaveBeenCalledWith({
      conversationId: "conv1",
      userId: "user2",
    });
    expect(defaultProps.onConversationUpdate).toHaveBeenCalled();
  });

  it("shows error when removing member fails", async () => {
    mockRemoveGroupMember.mockResolvedValue({
      success: false,
      message: "Cannot remove member",
    });
    const user = userEvent.setup();
    render(<GroupChatSettings {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByLabelText("Remove Member User"));
    });

    expect(
      screen.getByText("Cannot remove member")
    ).toBeInTheDocument();
  });

  // ─── Participant links ────────────────────────────────────

  it("renders profile links for participants with usernames", () => {
    render(<GroupChatSettings {...defaultProps} />);
    const links = screen.getAllByRole("link");
    const adminLink = links.find(
      (link) => link.getAttribute("href") === "/admin"
    );
    expect(adminLink).toBeDefined();
  });
});
