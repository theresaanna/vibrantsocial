import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FriendButton } from "@/components/friend-button";

const mockSendFriendRequest = vi.fn().mockResolvedValue({ success: false, message: "" });
const mockAcceptFriendRequest = vi.fn().mockResolvedValue({ success: false, message: "" });
const mockDeclineFriendRequest = vi.fn().mockResolvedValue({ success: false, message: "" });
const mockRemoveFriend = vi.fn().mockResolvedValue({ success: false, message: "" });

vi.mock("@/app/feed/friend-actions", () => ({
  sendFriendRequest: (...args: unknown[]) => mockSendFriendRequest(...args),
  acceptFriendRequest: (...args: unknown[]) => mockAcceptFriendRequest(...args),
  declineFriendRequest: (...args: unknown[]) => mockDeclineFriendRequest(...args),
  removeFriend: (...args: unknown[]) => mockRemoveFriend(...args),
}));

// jsdom does not implement showModal/close on <dialog>, so we polyfill them.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ??
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ??
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
});

describe("FriendButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- "none" status: Add Friend ---

  it("renders 'Add Friend' button when status is 'none'", () => {
    render(<FriendButton userId="user2" friendshipStatus="none" />);
    expect(
      screen.getByRole("button", { name: "Add Friend" })
    ).toBeInTheDocument();
  });

  it("'Add Friend' has border-fuchsia outline styling", () => {
    render(<FriendButton userId="user2" friendshipStatus="none" />);
    const btn = screen.getByRole("button", { name: "Add Friend" });
    expect(btn.className).toContain("border-fuchsia-500");
    expect(btn.className).toContain("bg-transparent");
  });

  it("has submit type on Add Friend button", () => {
    render(<FriendButton userId="user2" friendshipStatus="none" />);
    expect(screen.getByRole("button", { name: "Add Friend" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("includes hidden userId input for 'none' status form", () => {
    const { container } = render(
      <FriendButton userId="user2" friendshipStatus="none" />
    );
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toHaveAttribute("value", "user2");
  });

  // --- "pending_sent" status ---

  it("renders 'Pending' when status is 'pending_sent'", () => {
    render(<FriendButton userId="user2" friendshipStatus="pending_sent" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("'Pending' has border-fuchsia styling", () => {
    render(<FriendButton userId="user2" friendshipStatus="pending_sent" />);
    const pending = screen.getByText("Pending");
    expect(pending.className).toContain("border-fuchsia-300");
  });

  // --- "pending_received" status ---

  it("renders Accept and Decline buttons when status is 'pending_received'", () => {
    render(
      <FriendButton
        userId="user2"
        friendshipStatus="pending_received"
        requestId="req1"
      />
    );
    expect(
      screen.getByRole("button", { name: "Accept" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decline" })
    ).toBeInTheDocument();
  });

  it("has submit type on Accept button", () => {
    render(
      <FriendButton
        userId="user2"
        friendshipStatus="pending_received"
        requestId="req1"
      />
    );
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("has submit type on Decline button", () => {
    render(
      <FriendButton
        userId="user2"
        friendshipStatus="pending_received"
        requestId="req1"
      />
    );
    expect(screen.getByRole("button", { name: "Decline" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("Accept button has vibrant gradient styling", () => {
    render(
      <FriendButton
        userId="user2"
        friendshipStatus="pending_received"
        requestId="req1"
      />
    );
    const btn = screen.getByRole("button", { name: "Accept" });
    expect(btn.className).toContain("bg-gradient-to-r");
    expect(btn.className).toContain("from-fuchsia-500");
    expect(btn.className).toContain("to-pink-500");
  });

  it("includes hidden requestId input for pending_received forms", () => {
    const { container } = render(
      <FriendButton
        userId="user2"
        friendshipStatus="pending_received"
        requestId="req1"
      />
    );
    const hiddenInputs = container.querySelectorAll(
      "input[name='requestId']"
    );
    expect(hiddenInputs).toHaveLength(2);
    hiddenInputs.forEach((input) => {
      expect(input).toHaveAttribute("value", "req1");
    });
  });

  // --- "friends" status ---

  it("renders 'Friends' button when status is 'friends'", () => {
    render(<FriendButton userId="user2" friendshipStatus="friends" />);
    expect(
      screen.getByRole("button", { name: "Friends" })
    ).toBeInTheDocument();
  });

  it("'Friends' button has type button (not submit) because unfriend uses confirmation", () => {
    render(<FriendButton userId="user2" friendshipStatus="friends" />);
    expect(screen.getByRole("button", { name: "Friends" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("'Friends' button has vibrant gradient styling", () => {
    render(<FriendButton userId="user2" friendshipStatus="friends" />);
    const btn = screen.getByRole("button", { name: "Friends" });
    expect(btn.className).toContain("bg-gradient-to-r");
    expect(btn.className).toContain("from-fuchsia-500");
    expect(btn.className).toContain("to-pink-500");
  });

  it("shows confirmation dialog when clicking 'Friends' (unfriend attempt)", async () => {
    const user = userEvent.setup();
    render(<FriendButton userId="user2" friendshipStatus="friends" />);

    await user.click(screen.getByRole("button", { name: "Friends" }));

    expect(screen.getByText("Unfriend?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unfriend" })
    ).toBeInTheDocument();
  });

  it("hides confirmation dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<FriendButton userId="user2" friendshipStatus="friends" />);

    await user.click(screen.getByRole("button", { name: "Friends" }));
    expect(screen.getByText("Unfriend?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Unfriend?")).not.toBeInTheDocument();
  });

  it("confirmation dialog has danger variant styling", async () => {
    const user = userEvent.setup();
    render(<FriendButton userId="user2" friendshipStatus="friends" />);

    await user.click(screen.getByRole("button", { name: "Friends" }));

    const unfriendBtn = screen.getByRole("button", { name: "Unfriend" });
    expect(unfriendBtn.className).toContain("bg-red-600");
  });

  it("form for remove has id friend-remove-form-{userId}", () => {
    const { container } = render(
      <FriendButton userId="user2" friendshipStatus="friends" />
    );
    const form = container.querySelector("form#friend-remove-form-user2");
    expect(form).toBeInTheDocument();
  });

  it("includes hidden userId input for 'friends' status form", () => {
    const { container } = render(
      <FriendButton userId="user2" friendshipStatus="friends" />
    );
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toHaveAttribute("value", "user2");
  });
});
