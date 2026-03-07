import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock IntersectionObserver for jsdom
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: IntersectionObserverCallback) {
    // no-op
  }
}
globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    toString: () => "",
  })),
}));

vi.mock("@/app/search/actions", () => ({
  searchUsers: vi.fn(),
  searchPosts: vi.fn(),
}));

vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid={`post-${post.id}`}>{post.content}</div>
  ),
}));

vi.mock("@/components/search-user-card", () => ({
  SearchUserCard: ({
    user,
  }: {
    user: { id: string; username: string | null };
  }) => <div data-testid={`user-${user.id}`}>@{user.username}</div>,
}));

import { searchUsers, searchPosts } from "@/app/search/actions";
import { SearchPageClient } from "@/app/search/search-page-client";

const mockSearchUsers = vi.mocked(searchUsers);
const mockSearchPosts = vi.mocked(searchPosts);

const defaultProps = {
  initialQuery: "",
  initialTab: "users" as const,
  initialUsers: { users: [], hasMore: false },
  initialPosts: { posts: [], hasMore: false },
  currentUserId: "user1",
  phoneVerified: true,
  biometricVerified: false,
  showNsfwByDefault: false,
};

describe("SearchPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders search input", () => {
    render(<SearchPageClient {...defaultProps} />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("renders Users and Posts tabs", () => {
    render(<SearchPageClient {...defaultProps} />);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
  });

  it("shows Users tab as active by default", () => {
    render(<SearchPageClient {...defaultProps} />);
    const usersTab = screen.getByText("Users");
    expect(usersTab.className).toContain("border-b-2");
  });

  it("switches to Posts tab when clicked", async () => {
    mockSearchPosts.mockResolvedValueOnce({ posts: [], hasMore: false });
    render(<SearchPageClient {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Posts"));
    });

    const postsTab = screen.getByText("Posts");
    expect(postsTab.className).toContain("border-b-2");
  });

  it("shows 'No users found' for empty user results after search", () => {
    render(
      <SearchPageClient
        {...defaultProps}
        initialQuery="alice"
        initialUsers={{ users: [], hasMore: false }}
      />
    );
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("shows 'No posts found' for empty post results after search", () => {
    render(
      <SearchPageClient
        {...defaultProps}
        initialQuery="hello"
        initialTab="posts"
        initialPosts={{ posts: [], hasMore: false }}
      />
    );
    expect(screen.getByText("No posts found")).toBeInTheDocument();
  });

  it("renders user cards for user results", () => {
    const users = [
      {
        id: "u1",
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: null,
        image: null,
        bio: "Hello",
        _count: { followers: 5, posts: 10 },
      },
      {
        id: "u2",
        username: "bob",
        displayName: "Bob",
        name: null,
        avatar: null,
        image: null,
        bio: null,
        _count: { followers: 2, posts: 3 },
      },
    ];
    render(
      <SearchPageClient
        {...defaultProps}
        initialQuery="test"
        initialUsers={{ users, hasMore: false }}
      />
    );
    expect(screen.getByTestId("user-u1")).toBeInTheDocument();
    expect(screen.getByTestId("user-u2")).toBeInTheDocument();
  });

  it("renders post cards for post results", () => {
    const posts = [
      { id: "p1", content: "Post one", createdAt: "2025-01-01T00:00:00Z" },
      { id: "p2", content: "Post two", createdAt: "2025-01-02T00:00:00Z" },
    ];
    render(
      <SearchPageClient
        {...defaultProps}
        initialQuery="post"
        initialTab="posts"
        initialPosts={{ posts, hasMore: false }}
      />
    );
    expect(screen.getByTestId("post-p1")).toBeInTheDocument();
    expect(screen.getByTestId("post-p2")).toBeInTheDocument();
  });

  it("debounces search input (does not call immediately)", async () => {
    mockSearchUsers.mockResolvedValue({ users: [], hasMore: false });
    render(<SearchPageClient {...defaultProps} />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "alice" } });

    // Should not have called yet (before debounce fires)
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it("calls search after debounce delay", async () => {
    mockSearchUsers.mockResolvedValue({ users: [], hasMore: false });
    render(<SearchPageClient {...defaultProps} />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "alice" } });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchUsers).toHaveBeenCalledWith("alice");
  });

  it("does not search for single character query", async () => {
    render(<SearchPageClient {...defaultProps} />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "a" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(mockSearchPosts).not.toHaveBeenCalled();
  });

  it("has search aria-label", () => {
    render(<SearchPageClient {...defaultProps} />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});
