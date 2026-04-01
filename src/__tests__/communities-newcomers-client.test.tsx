import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CommunitiesNewcomersClient } from "@/app/communities/communities-newcomers-client";

const mockUsers = [
  {
    id: "u1",
    username: "alice",
    displayName: "Alice",
    name: "Alice A",
    avatar: null,
    image: null,
    profileFrameId: null,
    usernameFont: null,
    bio: null,
    _count: { followers: 10, posts: 5 },
  },
  {
    id: "u2",
    username: "bob",
    displayName: "Bob",
    name: "Bob B",
    avatar: null,
    image: null,
    profileFrameId: null,
    usernameFont: null,
    bio: null,
    _count: { followers: 3, posts: 1 },
  },
];

vi.mock("@/app/communities/newcomer-actions", () => ({
  fetchNewcomers: vi.fn(),
}));

// Mock FramedAvatar to avoid image rendering issues in tests
vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <div data-testid="avatar">{alt}</div>,
}));

import { fetchNewcomers } from "@/app/communities/newcomer-actions";

describe("CommunitiesNewcomersClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a list of newcomer users", async () => {
    vi.mocked(fetchNewcomers).mockResolvedValue(mockUsers);

    render(<CommunitiesNewcomersClient />);

    await waitFor(() => {
      expect(screen.getByTestId("newcomers-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("shows empty state when no newcomers", async () => {
    vi.mocked(fetchNewcomers).mockResolvedValue([]);

    render(<CommunitiesNewcomersClient />);

    await waitFor(() => {
      expect(screen.getByTestId("no-newcomers")).toBeInTheDocument();
    });

    expect(screen.getByText("No newcomers yet.")).toBeInTheDocument();
  });

  it("shows follower and post counts", async () => {
    vi.mocked(fetchNewcomers).mockResolvedValue([mockUsers[0]]);

    render(<CommunitiesNewcomersClient />);

    await waitFor(() => {
      expect(screen.getByTestId("newcomers-list")).toBeInTheDocument();
    });

    expect(screen.getByText("10 followers")).toBeInTheDocument();
    expect(screen.getByText("5 posts")).toBeInTheDocument();
  });

  it("renders user profile links", async () => {
    vi.mocked(fetchNewcomers).mockResolvedValue([mockUsers[0]]);

    render(<CommunitiesNewcomersClient />);

    await waitFor(() => {
      expect(screen.getByTestId("newcomers-list")).toBeInTheDocument();
    });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/alice");
  });
});
