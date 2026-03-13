import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("FriendButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Add Friend' button when status is 'none'", () => {
    render(
      <FriendButton userId="user2" friendshipStatus="none" />
    );
    expect(
      screen.getByRole("button", { name: "Add Friend" })
    ).toBeInTheDocument();
  });

  it("renders 'Pending' when status is 'pending_sent'", () => {
    render(
      <FriendButton userId="user2" friendshipStatus="pending_sent" />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

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

  it("renders 'Friends' button when status is 'friends'", () => {
    render(
      <FriendButton userId="user2" friendshipStatus="friends" />
    );
    expect(
      screen.getByRole("button", { name: "Friends" })
    ).toBeInTheDocument();
  });

  it("has submit type on Add Friend button", () => {
    render(
      <FriendButton userId="user2" friendshipStatus="none" />
    );
    expect(screen.getByRole("button", { name: "Add Friend" })).toHaveAttribute(
      "type",
      "submit"
    );
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

  it("has submit type on Friends (remove) button", () => {
    render(
      <FriendButton userId="user2" friendshipStatus="friends" />
    );
    expect(screen.getByRole("button", { name: "Friends" })).toHaveAttribute(
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

  it("includes hidden userId input for 'friends' status form", () => {
    const { container } = render(
      <FriendButton userId="user2" friendshipStatus="friends" />
    );
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toHaveAttribute("value", "user2");
  });
});
