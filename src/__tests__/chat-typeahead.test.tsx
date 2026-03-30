import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock server actions before imports
vi.mock("@/app/chat/actions", () => ({
  searchUsers: vi.fn(),
}));

vi.mock("@/app/tags/actions", () => ({
  searchTags: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "me", tier: "free" } },
    status: "authenticated",
  }),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: vi.fn(),
}));

import { searchUsers } from "@/app/chat/actions";
import { searchTags } from "@/app/tags/actions";
import { MessageInput } from "@/components/chat/message-input";

const mockSearchUsers = vi.mocked(searchUsers);
const mockSearchTags = vi.mocked(searchTags);

const mockUsers = [
  {
    id: "u1",
    username: "alice",
    displayName: "Alice Smith",
    name: "Alice",
    avatar: null,
    image: null,
    profileFrameId: null,
    usernameFont: null,
  },
  {
    id: "u2",
    username: "bob",
    displayName: "Bob Jones",
    name: "Bob",
    avatar: null,
    image: null,
    profileFrameId: null,
    usernameFont: null,
  },
];

const mockTags = [
  { id: "t1", name: "photography", count: 42 },
  { id: "t2", name: "photoshop", count: 15 },
];

function renderMessageInput() {
  return render(
    <MessageInput
      onSendMessage={vi.fn()}
      onKeystroke={vi.fn()}
      onStopTyping={vi.fn()}
    />
  );
}

describe("Chat MessageInput typeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSearchUsers.mockResolvedValue([]);
    mockSearchTags.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("@mention typeahead", () => {
    it("shows mention dropdown when typing @", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@al" } });
        fireEvent.input(textarea);
      });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      expect(screen.getByTestId("mention-option-alice")).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("@alice")).toBeInTheDocument();
    });

    it("inserts mention when clicking a suggestion", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText(
        "Type a message..."
      ) as HTMLTextAreaElement;

      // Set selectionStart to simulate cursor at end
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@al" } });
        Object.defineProperty(textarea, "selectionStart", { value: 3, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("mention-option-alice")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("mention-option-alice"));
      });

      expect(textarea.value).toBe("@alice ");
    });

    it("calls searchUsers with the typed query", async () => {
      mockSearchUsers.mockResolvedValue([]);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@bo" } });
        Object.defineProperty(textarea, "selectionStart", { value: 3, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(mockSearchUsers).toHaveBeenCalledWith("bo");
    });

    it("does not show dropdown when no results", async () => {
      mockSearchUsers.mockResolvedValue([]);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@zzz" } });
        Object.defineProperty(textarea, "selectionStart", { value: 4, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.queryByTestId("typeahead-dropdown")).not.toBeInTheDocument();
    });

    it("navigates dropdown with arrow keys", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@a" } });
        Object.defineProperty(textarea, "selectionStart", { value: 2, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      // First item selected by default
      expect(screen.getByTestId("mention-option-alice").getAttribute("aria-selected")).toBe("true");

      // Arrow down to second
      await act(async () => {
        fireEvent.keyDown(textarea, { key: "ArrowDown" });
      });

      expect(screen.getByTestId("mention-option-bob").getAttribute("aria-selected")).toBe("true");
    });

    it("selects mention with Enter key", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText(
        "Type a message..."
      ) as HTMLTextAreaElement;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@al" } });
        Object.defineProperty(textarea, "selectionStart", { value: 3, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      // Press Enter to select first option
      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter" });
      });

      expect(textarea.value).toBe("@alice ");
      // Dropdown should close
      expect(screen.queryByTestId("typeahead-dropdown")).not.toBeInTheDocument();
    });

    it("closes dropdown on Escape", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@al" } });
        Object.defineProperty(textarea, "selectionStart", { value: 3, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Escape" });
      });

      expect(screen.queryByTestId("typeahead-dropdown")).not.toBeInTheDocument();
    });

    it("Enter sends message when dropdown is closed", async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      render(
        <MessageInput
          onSendMessage={onSend}
          onKeystroke={vi.fn()}
          onStopTyping={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "hello world" } });
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter" });
      });

      expect(onSend).toHaveBeenCalledWith("hello world", undefined);
    });

    it("Enter does NOT send message when dropdown is open", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      const onSend = vi.fn().mockResolvedValue(undefined);
      render(
        <MessageInput
          onSendMessage={onSend}
          onKeystroke={vi.fn()}
          onStopTyping={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "@al" } });
        Object.defineProperty(textarea, "selectionStart", { value: 3, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter" });
      });

      // Should NOT have sent the message
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("#hashtag typeahead", () => {
    it("shows tag dropdown when typing #", async () => {
      mockSearchTags.mockResolvedValue(mockTags);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "#photo" } });
        Object.defineProperty(textarea, "selectionStart", { value: 6, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });

      expect(screen.getByTestId("tag-option-photography")).toBeInTheDocument();
      expect(screen.getByText("#photography")).toBeInTheDocument();
      expect(screen.getByText("42 posts")).toBeInTheDocument();
    });

    it("inserts hashtag when clicking a suggestion", async () => {
      mockSearchTags.mockResolvedValue(mockTags);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText(
        "Type a message..."
      ) as HTMLTextAreaElement;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: "#photo" } });
        Object.defineProperty(textarea, "selectionStart", { value: 6, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("tag-option-photography")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("tag-option-photography"));
      });

      expect(textarea.value).toBe("#photography ");
    });

    it("calls searchTags with the typed query", async () => {
      mockSearchTags.mockResolvedValue([]);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "#art" } });
        Object.defineProperty(textarea, "selectionStart", { value: 4, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(mockSearchTags).toHaveBeenCalledWith("art");
    });
  });

  describe("mid-message triggers", () => {
    it("detects @ trigger in the middle of text", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: "hey @al how are you" },
        });
        // Cursor right after "@al"
        Object.defineProperty(textarea, "selectionStart", { value: 7, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });
    });

    it("detects # trigger in the middle of text", async () => {
      mockSearchTags.mockResolvedValue(mockTags);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: "check out #photo stuff" },
        });
        // Cursor right after "#photo"
        Object.defineProperty(textarea, "selectionStart", { value: 16, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("typeahead-dropdown")).toBeInTheDocument();
      });
    });

    it("inserts mention mid-message preserving surrounding text", async () => {
      mockSearchUsers.mockResolvedValue(mockUsers);
      renderMessageInput();

      const textarea = screen.getByPlaceholderText(
        "Type a message..."
      ) as HTMLTextAreaElement;

      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: "hey @al how are you" },
        });
        Object.defineProperty(textarea, "selectionStart", { value: 7, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByTestId("mention-option-alice")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("mention-option-alice"));
      });

      expect(textarea.value).toBe("hey @alice  how are you");
    });
  });

  describe("no trigger without prefix", () => {
    it("does not trigger on email addresses", async () => {
      renderMessageInput();

      const textarea = screen.getByPlaceholderText("Type a message...");
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: "test@example" },
        });
        Object.defineProperty(textarea, "selectionStart", { value: 12, writable: true });
        fireEvent.input(textarea);
      });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // No dropdown should appear since @ is preceded by non-whitespace
      expect(screen.queryByTestId("typeahead-dropdown")).not.toBeInTheDocument();
    });
  });
});
