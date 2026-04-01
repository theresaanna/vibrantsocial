import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserStatusHistory } from "@/components/user-status-history";

vi.mock("@/app/feed/status-actions", () => ({
  deleteStatus: vi.fn(),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

vi.mock("@/components/styled-name", () => ({
  StyledName: ({ displayName, username }: { displayName?: string | null; username?: string | null }) => (
    <span>{displayName || username}</span>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "5m ago",
}));

const user = {
  id: "user1",
  username: "alice",
  displayName: "Alice",
  name: null,
  avatar: null,
  image: null,
  profileFrameId: null,
  usernameFont: null,
};

function makeStatus(id: string, content: string) {
  return {
    id,
    content,
    createdAt: new Date().toISOString(),
    user,
  };
}

describe("UserStatusHistory", () => {
  it("renders list of statuses", () => {
    const statuses = [
      makeStatus("s1", "Hello world"),
      makeStatus("s2", "Feeling good"),
    ];

    render(
      <UserStatusHistory statuses={statuses} currentUserId="other" username="alice" />,
    );

    expect(screen.getByText("Hello world")).toBeDefined();
    expect(screen.getByText("Feeling good")).toBeDefined();
    expect(screen.getAllByTestId("status-history-item")).toHaveLength(2);
  });

  it("shows delete button only for own statuses", () => {
    const statuses = [makeStatus("s1", "My status")];

    const { rerender } = render(
      <UserStatusHistory statuses={statuses} currentUserId="user1" username="alice" />,
    );

    expect(screen.getByTestId("delete-status-btn")).toBeDefined();

    // Re-render as different user
    rerender(
      <UserStatusHistory statuses={statuses} currentUserId="other" username="alice" />,
    );

    expect(screen.queryByTestId("delete-status-btn")).toBeNull();
  });

  it("shows empty state when no statuses", () => {
    render(
      <UserStatusHistory statuses={[]} currentUserId="user1" username="alice" />,
    );

    expect(screen.getByText("No statuses yet.")).toBeDefined();
  });
});
