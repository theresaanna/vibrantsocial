import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockGetAcceptedFriends = vi.fn();

vi.mock("@/app/feed/close-friends-actions", () => ({
  getAcceptedFriends: (...args: unknown[]) => mockGetAcceptedFriends(...args),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => (
    <div data-testid={`avatar-${alt}`} />
  ),
}));

import { AudiencePicker } from "@/components/audience-picker";

const MOCK_FRIENDS = [
  {
    id: "friend-1",
    username: "alice",
    displayName: "Alice Smith",
    name: "Alice",
    avatar: null,
    profileFrameId: null,
    image: null,
  },
  {
    id: "friend-2",
    username: "bob",
    displayName: "Bob Jones",
    name: "Bob",
    avatar: null,
    profileFrameId: null,
    image: null,
  },
  {
    id: "friend-3",
    username: "charlie",
    displayName: "Charlie Brown",
    name: "Charlie",
    avatar: null,
    profileFrameId: null,
    image: null,
  },
];

describe("AudiencePicker", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedIds: [] as string[],
    onSelectionChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAcceptedFriends.mockResolvedValue(MOCK_FRIENDS);
  });

  it("does not render when isOpen is false", () => {
    render(<AudiencePicker {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Custom Audience")).not.toBeInTheDocument();
  });

  it("renders the modal when open", async () => {
    render(<AudiencePicker {...defaultProps} />);
    expect(screen.getByText("Custom Audience")).toBeInTheDocument();
    expect(screen.getByTestId("audience-search")).toBeInTheDocument();
  });

  it("loads and displays friends", async () => {
    render(<AudiencePicker {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockGetAcceptedFriends.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AudiencePicker {...defaultProps} />);
    expect(screen.getByText("Loading friends...")).toBeInTheDocument();
  });

  it("shows empty state when no friends", async () => {
    mockGetAcceptedFriends.mockResolvedValue([]);
    render(<AudiencePicker {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No friends to select. Add friends first!")).toBeInTheDocument();
    });
  });

  it("selects a friend when checkbox is clicked", async () => {
    const onSelectionChange = vi.fn();
    render(
      <AudiencePicker {...defaultProps} onSelectionChange={onSelectionChange} />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId("audience-friend-friend-1").querySelector("input[type='checkbox']");
    fireEvent.click(checkbox!);
    expect(onSelectionChange).toHaveBeenCalledWith(["friend-1"]);
  });

  it("deselects a friend when checkbox is unchecked", async () => {
    const onSelectionChange = vi.fn();
    render(
      <AudiencePicker
        {...defaultProps}
        selectedIds={["friend-1", "friend-2"]}
        onSelectionChange={onSelectionChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId("audience-friend-friend-1").querySelector("input[type='checkbox']");
    fireEvent.click(checkbox!);
    expect(onSelectionChange).toHaveBeenCalledWith(["friend-2"]);
  });

  it("selects all friends when Select All is clicked", async () => {
    const onSelectionChange = vi.fn();
    render(
      <AudiencePicker {...defaultProps} onSelectionChange={onSelectionChange} />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("select-all"));
    expect(onSelectionChange).toHaveBeenCalledWith(["friend-1", "friend-2", "friend-3"]);
  });

  it("deselects all friends when Deselect All is clicked", async () => {
    const onSelectionChange = vi.fn();
    render(
      <AudiencePicker
        {...defaultProps}
        selectedIds={["friend-1", "friend-2"]}
        onSelectionChange={onSelectionChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("deselect-all"));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("filters friends by search input", async () => {
    render(<AudiencePicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("audience-search");
    fireEvent.change(searchInput, { target: { value: "alice" } });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
  });

  it("shows no results message when search matches nothing", async () => {
    render(<AudiencePicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("audience-search");
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(screen.getByText("No friends match your search.")).toBeInTheDocument();
  });

  it("shows correct selection count", async () => {
    render(
      <AudiencePicker {...defaultProps} selectedIds={["friend-1", "friend-3"]} />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 of 3 selected/)).toBeInTheDocument();
    });
  });

  it("calls onClose when Done button is clicked", async () => {
    const onClose = vi.fn();
    render(<AudiencePicker {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("audience-done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<AudiencePicker {...defaultProps} onClose={onClose} />);

    // The backdrop is the dialog element itself (the overlay)
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks selected friends as checked", async () => {
    render(
      <AudiencePicker {...defaultProps} selectedIds={["friend-2"]} />
    );

    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    const aliceCheckbox = screen.getByTestId("audience-friend-friend-1").querySelector("input[type='checkbox']") as HTMLInputElement;
    const bobCheckbox = screen.getByTestId("audience-friend-friend-2").querySelector("input[type='checkbox']") as HTMLInputElement;

    expect(aliceCheckbox.checked).toBe(false);
    expect(bobCheckbox.checked).toBe(true);
  });
});
