import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { NotificationBell } from "@/components/notification-bell";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: "user1" } },
  }),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

const mockGetUnreadNotificationCount = vi.fn().mockResolvedValue(0);
const mockGetRecentNotifications = vi.fn().mockResolvedValue([]);
const mockMarkNotificationRead = vi.fn().mockResolvedValue(undefined);
const mockMarkAllNotificationsRead = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/notifications/actions", () => ({
  getUnreadNotificationCount: (...args: unknown[]) =>
    mockGetUnreadNotificationCount(...args),
  getRecentNotifications: (...args: unknown[]) =>
    mockGetRecentNotifications(...args),
  markNotificationRead: (...args: unknown[]) =>
    mockMarkNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) =>
    mockMarkAllNotificationsRead(...args),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("1m ago"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const makeNotification = (
  id: string,
  type: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  type,
  actorId: "actor1",
  postId: "post1",
  commentId: null,
  messageId: null,
  repostId: null,
  readAt: null,
  createdAt: new Date("2024-01-01"),
  actor: {
    id: "actor1",
    username: "alice",
    displayName: "Alice",
    name: "Alice",
    image: null,
    avatar: null,
  },
  post: { id: "post1", content: "Hello" },
  message: null,
  tag: null,
  ...overrides,
});

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bell icon button", () => {
    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("shows badge count when unread > 0", () => {
    render(
      <NotificationBell initialUnreadCount={5} initialNotifications={[]} />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ when unread count exceeds 99", () => {
    render(
      <NotificationBell initialUnreadCount={150} initialNotifications={[]} />
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("does not show badge when unread is 0", () => {
    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens dropdown when bell is clicked", () => {
    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows empty state when there are no notifications", () => {
    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("lists notifications in the dropdown", () => {
    const notifications = [
      makeNotification("n1", "LIKE"),
      makeNotification("n2", "COMMENT"),
    ];
    render(
      <NotificationBell
        initialUnreadCount={2}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("liked your post")).toBeInTheDocument();
    expect(screen.getByText("commented on your post")).toBeInTheDocument();
  });

  it("shows 'Mark all read' button when there are unread notifications", () => {
    const notifications = [makeNotification("n1", "LIKE")];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
  });

  it("does not show 'Mark all read' when all are read", () => {
    const notifications = [
      makeNotification("n1", "LIKE", { readAt: new Date() }),
    ];
    render(
      <NotificationBell
        initialUnreadCount={0}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
  });

  it("calls markAllNotificationsRead when clicking Mark all read", () => {
    const notifications = [makeNotification("n1", "LIKE")];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    fireEvent.click(screen.getByText("Mark all read"));
    expect(mockMarkAllNotificationsRead).toHaveBeenCalled();
  });

  it("marks a notification as read when clicking it", () => {
    const notifications = [makeNotification("n1", "LIKE")];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    fireEvent.click(screen.getByText("liked your post"));
    expect(mockMarkNotificationRead).toHaveBeenCalledWith("n1");
  });

  it("displays correct notification text for each type", () => {
    const types = [
      { type: "LIKE", text: "liked your post" },
      { type: "COMMENT", text: "commented on your post" },
      { type: "REPLY", text: "replied to your comment" },
      { type: "REPOST", text: "reposted your post" },
      { type: "FOLLOW", text: "followed you" },
      { type: "MENTION", text: "mentioned you" },
      { type: "FRIEND_REQUEST", text: "sent you a friend request" },
    ];

    for (const { type, text } of types) {
      const { unmount } = render(
        <NotificationBell
          initialUnreadCount={1}
          initialNotifications={[makeNotification("n1", type)]}
        />
      );
      fireEvent.click(screen.getByLabelText("Notifications"));
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    }
  });

  it("shows actor avatar when available", () => {
    const notifications = [
      makeNotification("n1", "LIKE", {
        actor: {
          id: "actor1",
          username: "alice",
          displayName: "Alice",
          name: "Alice",
          image: null,
          avatar: "https://example.com/avatar.jpg",
        },
      }),
    ];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const img = screen.getByAltText("Alice");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows initial letter when no avatar is available", () => {
    const notifications = [makeNotification("n1", "LIKE")];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("links to /notifications via View all notifications", () => {
    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const link = screen.getByText("View all notifications");
    expect(link).toHaveAttribute("href", "/notifications");
  });

  it("generates correct href for COMMENT notifications with commentId", () => {
    const notifications = [
      makeNotification("n1", "COMMENT", {
        postId: "p1",
        commentId: "c1",
      }),
    ];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const link = screen.getByText("commented on your post").closest("a");
    expect(link).toHaveAttribute("href", "/post/p1?commentId=c1");
  });

  it("generates correct href for FRIEND_REQUEST notifications", () => {
    const notifications = [makeNotification("n1", "FRIEND_REQUEST")];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const link = screen
      .getByText("sent you a friend request")
      .closest("a");
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("generates correct href for REACTION notifications with message", () => {
    const notifications = [
      makeNotification("n1", "REACTION", {
        postId: null,
        message: { id: "msg1", conversationId: "conv1" },
      }),
    ];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const link = screen.getByText("reacted to your message").closest("a");
    expect(link).toHaveAttribute("href", "/chat/conv1");
  });

  it("generates correct href for notification with repostId fallback", () => {
    const notifications = [
      makeNotification("n1", "REPOST", {
        postId: null,
        repostId: "repost1",
      }),
    ];
    render(
      <NotificationBell
        initialUnreadCount={1}
        initialNotifications={notifications}
      />
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    const link = screen.getByText("reposted your post").closest("a");
    expect(link).toHaveAttribute("href", "/quote/repost1");
  });

  it("refreshes notifications when pane opens", async () => {
    const freshNotifications = [makeNotification("fresh1", "FOLLOW")];
    mockGetRecentNotifications.mockResolvedValue(freshNotifications);

    render(
      <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Notifications"));
    });

    await waitFor(() => {
      expect(mockGetRecentNotifications).toHaveBeenCalled();
    });
  });

  it("closes pane when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <NotificationBell initialUnreadCount={0} initialNotifications={[]} />
      </div>
    );
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    // The dropdown should be closed (opacity-0 / pointer-events-none)
    const dropdown = screen.getByText("Notifications").closest(".absolute");
    expect(dropdown?.className).toContain("pointer-events-none");
  });
});
