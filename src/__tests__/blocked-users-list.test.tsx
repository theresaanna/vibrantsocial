import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockedUsersList } from "@/app/blocked/blocked-users-list";

vi.mock("@/app/feed/block-actions", () => ({
  toggleBlock: vi.fn(),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt, initial }: { alt: string; initial: string }) => (
    <div data-testid="avatar">{initial}</div>
  ),
}));

vi.mock("@/components/styled-name", () => ({
  StyledName: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const mockUsers = [
  {
    id: "u1",
    username: "alice",
    displayName: "Alice",
    name: "Alice A",
    avatar: "/alice.jpg",
    image: null,
    profileFrameId: null,
    usernameFont: null,
  },
  {
    id: "u2",
    username: "bob",
    displayName: "Bob",
    name: "Bob B",
    avatar: null,
    image: "/bob.jpg",
    profileFrameId: "frame-1",
    usernameFont: "monospace",
  },
  {
    id: "u3",
    username: "charlie",
    displayName: null,
    name: null,
    avatar: null,
    image: null,
    profileFrameId: null,
    usernameFont: null,
  },
];

describe("BlockedUsersList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no users are blocked", () => {
    render(<BlockedUsersList users={[]} />);

    expect(screen.getByTestId("no-blocked-users")).toBeInTheDocument();
    expect(screen.getByText("You haven't blocked anyone.")).toBeInTheDocument();
  });

  it("renders the blocked users list", () => {
    render(<BlockedUsersList users={mockUsers} />);

    expect(screen.getByTestId("blocked-users-list")).toBeInTheDocument();
  });

  it("renders each blocked user with display name and username", () => {
    render(<BlockedUsersList users={mockUsers} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("falls back to username when displayName and name are null", () => {
    render(<BlockedUsersList users={mockUsers} />);

    // Charlie has no displayName or name, should show username
    expect(screen.getByText("charlie")).toBeInTheDocument();
    expect(screen.getByText("@charlie")).toBeInTheDocument();
  });

  it("renders an unblock button for each user", () => {
    render(<BlockedUsersList users={mockUsers} />);

    expect(screen.getByTestId("unblock-button-u1")).toBeInTheDocument();
    expect(screen.getByTestId("unblock-button-u2")).toBeInTheDocument();
    expect(screen.getByTestId("unblock-button-u3")).toBeInTheDocument();
  });

  it("renders unblock buttons with correct text", () => {
    render(<BlockedUsersList users={mockUsers} />);

    const buttons = screen.getAllByText("Unblock");
    expect(buttons).toHaveLength(3);
  });

  it("renders links to user profiles", () => {
    render(<BlockedUsersList users={mockUsers} />);

    const links = screen.getAllByRole("link");
    // Each user has 2 links (avatar + name)
    expect(links.length).toBeGreaterThanOrEqual(6);
    expect(links[0]).toHaveAttribute("href", "/alice");
  });

  it("renders test IDs for each blocked user row", () => {
    render(<BlockedUsersList users={mockUsers} />);

    expect(screen.getByTestId("blocked-user-u1")).toBeInTheDocument();
    expect(screen.getByTestId("blocked-user-u2")).toBeInTheDocument();
    expect(screen.getByTestId("blocked-user-u3")).toBeInTheDocument();
  });

  it("renders avatar with correct initial", () => {
    render(<BlockedUsersList users={mockUsers} />);

    const avatars = screen.getAllByTestId("avatar");
    expect(avatars[0]).toHaveTextContent("A"); // Alice
    expect(avatars[1]).toHaveTextContent("B"); // Bob
  });

  it("renders hidden form fields for unblock action", () => {
    const { container } = render(<BlockedUsersList users={[mockUsers[0]]} />);

    const hiddenInputs = container.querySelectorAll('input[type="hidden"]');
    const userIdInput = Array.from(hiddenInputs).find(
      (input) => input.getAttribute("name") === "userId"
    );
    const blockByPhoneInput = Array.from(hiddenInputs).find(
      (input) => input.getAttribute("name") === "blockByPhone"
    );

    expect(userIdInput).toHaveValue("u1");
    expect(blockByPhoneInput).toHaveValue("false");
  });

  it("renders single user list correctly", () => {
    render(<BlockedUsersList users={[mockUsers[0]]} />);

    expect(screen.getByTestId("blocked-users-list")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Unblock")).toHaveLength(1);
  });

  it("does not render list element when empty", () => {
    render(<BlockedUsersList users={[]} />);

    expect(screen.queryByTestId("blocked-users-list")).not.toBeInTheDocument();
  });
});
