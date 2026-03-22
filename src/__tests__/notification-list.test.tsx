import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationList } from "@/components/notification-list";

const mockDeleteNotifications = vi.fn().mockResolvedValue({ success: true, deletedCount: 1 });

vi.mock("@/app/notifications/actions", () => ({
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
  deleteNotifications: (...args: unknown[]) => mockDeleteNotifications(...args),
}));

const mockRespondToFriendRequestByActor = vi.fn();
vi.mock("@/app/feed/friend-actions", () => ({
  respondToFriendRequestByActor: (...args: unknown[]) =>
    mockRespondToFriendRequestByActor(...args),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

const baseActor = {
  id: "actor1",
  username: "alice",
  displayName: "Alice",
  name: "Alice",
  image: null,
  avatar: null,
};

// JSDOM doesn't implement HTMLDialogElement methods
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();

describe("NotificationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no notifications", () => {
    render(<NotificationList initialNotifications={[]} />);
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("links COMMENT notification to /post/[postId]?commentId=[commentId]", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n1",
            type: "COMMENT",
            actorId: "actor1",
            postId: "post123",
            commentId: "comment456",
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post123", content: "My post" },
          },
        ]}
      />
    );
    const link = screen.getByText("commented on your post").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/post/post123?commentId=comment456"
    );
  });

  it("links REPLY notification to /post/[postId]?commentId=[commentId]", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n2",
            type: "REPLY",
            actorId: "actor1",
            postId: "post123",
            commentId: "reply789",
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post123", content: "My post" },
          },
        ]}
      />
    );
    const link = screen.getByText("replied to your comment").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "/post/post123?commentId=reply789"
    );
  });

  it("links LIKE notification to /post/[postId] without commentId", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n3",
            type: "LIKE",
            actorId: "actor1",
            postId: "post123",
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post123", content: "My post" },
          },
        ]}
      />
    );
    const link = screen.getByText("liked your post").closest("a");
    expect(link).toHaveAttribute("href", "/post/post123");
  });

  it("links FOLLOW notification to /notifications", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n4",
            type: "FOLLOW",
            actorId: "actor1",
            postId: null,
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: null,
          },
        ]}
      />
    );
    const link = screen.getByText("followed you").closest("a");
    expect(link).toHaveAttribute("href", "/notifications");
  });

  it("links REPOST notification to /post/[postId]", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n5",
            type: "REPOST",
            actorId: "actor1",
            postId: "post123",
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post123", content: "My post" },
          },
        ]}
      />
    );
    const link = screen.getByText("reposted your post").closest("a");
    expect(link).toHaveAttribute("href", "/post/post123");
  });

  it("links BOOKMARK notification to /post/[postId]", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n6",
            type: "BOOKMARK",
            actorId: "actor1",
            postId: "post123",
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post123", content: "My post" },
          },
        ]}
      />
    );
    const link = screen.getByText("bookmarked your post").closest("a");
    expect(link).toHaveAttribute("href", "/post/post123");
  });

  it("links REACTION notification to /chat/[conversationId]", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n-reaction",
            type: "REACTION",
            actorId: "actor1",
            postId: null,
            commentId: null,
            messageId: "msg1",
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: null,
            message: { id: "msg1", conversationId: "conv123" },
          },
        ]}
      />
    );
    const link = screen.getByText("reacted to your message").closest("a");
    expect(link).toHaveAttribute("href", "/chat/conv123");
  });

  it("shows unread indicator for unread notifications", () => {
    const { container } = render(
      <NotificationList
        initialNotifications={[
          {
            id: "n7",
            type: "LIKE",
            actorId: "actor1",
            postId: "post1",
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post1", content: "Content" },
          },
        ]}
      />
    );
    // Unread dot indicator
    const dot = container.querySelector(".bg-blue-500.rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("shows mark all as read button when there are unread notifications", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n8",
            type: "LIKE",
            actorId: "actor1",
            postId: "post1",
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: { id: "post1", content: "Content" },
          },
        ]}
      />
    );
    expect(screen.getByText("Mark all as read")).toBeInTheDocument();
  });

  it("shows Accept/Decline buttons for pending FRIEND_REQUEST notifications", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n-fr",
            type: "FRIEND_REQUEST",
            actorId: "actor1",
            postId: null,
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: null,
            hasPendingFriendRequest: true,
          },
        ]}
      />
    );
    expect(screen.getByText("sent you a friend request")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("does not show Accept/Decline buttons for non-pending FRIEND_REQUEST notifications", () => {
    render(
      <NotificationList
        initialNotifications={[
          {
            id: "n-fr2",
            type: "FRIEND_REQUEST",
            actorId: "actor1",
            postId: null,
            commentId: null,
            readAt: null,
            createdAt: new Date(),
            actor: baseActor,
            post: null,
            hasPendingFriendRequest: false,
          },
        ]}
      />
    );
    expect(screen.getByText("sent you a friend request")).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  /* ── Bulk selection & delete ─────────────────────────── */

  const twoNotifications = [
    {
      id: "n1",
      type: "LIKE" as const,
      actorId: "actor1",
      postId: "post1",
      commentId: null,
      messageId: null,
      repostId: null,
      readAt: new Date(),
      createdAt: new Date(),
      actor: baseActor,
      post: { id: "post1", content: "Content" },
      message: null,
      tag: null,
    },
    {
      id: "n2",
      type: "FOLLOW" as const,
      actorId: "actor1",
      postId: null,
      commentId: null,
      messageId: null,
      repostId: null,
      readAt: new Date(),
      createdAt: new Date(),
      actor: baseActor,
      post: null,
      message: null,
      tag: null,
    },
  ];

  it("shows Select button that enters selection mode", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Select"));
    expect(screen.getByText("Select all")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows checkboxes in selection mode", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    await userEvent.click(screen.getByText("Select"));
    // 2 row checkboxes + 1 select all checkbox
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("toggles individual selection", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    await userEvent.click(screen.getByText("Select"));

    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] is "select all", checkboxes[1] and [2] are rows
    await userEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("select all checks all notifications", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    await userEvent.click(screen.getByText("Select"));

    await userEvent.click(screen.getByText("Select all"));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).toBeChecked();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("shows Delete button only when items are selected", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    await userEvent.click(screen.getByText("Select"));
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("Cancel exits selection mode", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    await userEvent.click(screen.getByText("Select"));
    expect(screen.getByText("Select all")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("Delete opens confirmation dialog and removes notifications on confirm", async () => {
    render(<NotificationList initialNotifications={twoNotifications} />);
    await userEvent.click(screen.getByText("Select"));

    // Select all and delete
    await userEvent.click(screen.getByText("Select all"));
    await userEvent.click(screen.getByText("Delete"));

    // Confirmation dialog should appear
    expect(screen.getByText("Delete notifications")).toBeInTheDocument();
    expect(screen.getByText(/delete 2 notifications/i)).toBeInTheDocument();

    // Confirm deletion
    // The ConfirmDialog has a "Delete" confirm button inside
    const confirmButtons = screen.getAllByText("Delete");
    // The last "Delete" button is the one in the dialog
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);

    // Notifications should be removed from list
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(mockDeleteNotifications).toHaveBeenCalledWith(["n1", "n2"]);
  });
});
