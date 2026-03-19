import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FriendRequestNotificationActions } from "@/components/friend-request-notification-actions";

const mockRespondToFriendRequestByActor = vi.fn();

vi.mock("@/app/feed/friend-actions", () => ({
  respondToFriendRequestByActor: (...args: unknown[]) =>
    mockRespondToFriendRequestByActor(...args),
}));

describe("FriendRequestNotificationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Accept and Decline buttons", () => {
    render(<FriendRequestNotificationActions actorId="actor1" />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("shows Accepted text after accepting", async () => {
    const user = userEvent.setup();
    mockRespondToFriendRequestByActor.mockResolvedValue({
      success: true,
      message: "Friend request accepted",
    });

    render(<FriendRequestNotificationActions actorId="actor1" />);

    await act(async () => {
      await user.click(screen.getByText("Accept"));
    });

    expect(mockRespondToFriendRequestByActor).toHaveBeenCalledWith(
      "actor1",
      "accept"
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  it("shows Declined text after declining", async () => {
    const user = userEvent.setup();
    mockRespondToFriendRequestByActor.mockResolvedValue({
      success: true,
      message: "Friend request declined",
    });

    render(<FriendRequestNotificationActions actorId="actor1" />);

    await act(async () => {
      await user.click(screen.getByText("Decline"));
    });

    expect(mockRespondToFriendRequestByActor).toHaveBeenCalledWith(
      "actor1",
      "decline"
    );
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  it("calls onRespond callback after successful action", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn();
    mockRespondToFriendRequestByActor.mockResolvedValue({
      success: true,
      message: "Friend request accepted",
    });

    render(
      <FriendRequestNotificationActions
        actorId="actor1"
        onRespond={onRespond}
      />
    );

    await act(async () => {
      await user.click(screen.getByText("Accept"));
    });

    expect(onRespond).toHaveBeenCalled();
  });

  it("does not show responded state on failure", async () => {
    const user = userEvent.setup();
    mockRespondToFriendRequestByActor.mockResolvedValue({
      success: false,
      message: "No pending friend request found",
    });

    render(<FriendRequestNotificationActions actorId="actor1" />);

    await act(async () => {
      await user.click(screen.getByText("Accept"));
    });

    // Buttons should still be visible on failure
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });
});
