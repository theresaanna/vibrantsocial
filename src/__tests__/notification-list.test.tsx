import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationList } from "@/components/notification-list";

vi.mock("@/app/notifications/actions", () => ({
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
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
});
