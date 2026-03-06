import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileForm } from "@/app/profile/profile-form";

// Mock next-auth/react
const mockUpdate = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => ({ update: mockUpdate }),
}));

// Mock next/link
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

// Mock server actions
vi.mock("@/app/profile/actions", () => ({
  updateProfile: vi.fn(),
  removeAvatar: vi.fn(),
}));

// Mock the BioEditor (Lexical is too heavy for jsdom unit tests)
vi.mock("@/components/bio-editor", () => ({
  BioEditor: ({ initialContent }: { initialContent?: string | null }) => (
    <div data-testid="bio-editor" data-initial-content={initialContent ?? ""}>
      <input type="hidden" name="bio" value={initialContent ?? ""} />
    </div>
  ),
}));

const defaultUser = {
  id: "user1",
  username: "testuser",
  displayName: "Test User",
  bio: null,
};

function renderForm(overrides: Partial<typeof defaultUser> = {}) {
  return render(
    <ProfileForm
      user={{ ...defaultUser, ...overrides }}
      currentAvatar={null}
      oauthImage={null}
    />
  );
}

describe("ProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Mock fetch for username checks
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("username status - no 'available' message for current username", () => {
    it("does not show 'available' when username matches the saved username", () => {
      renderForm({ username: "testuser" });

      const input = screen.getByPlaceholderText("your_username");
      expect(input).toHaveValue("testuser");
      expect(
        screen.queryByText("Username is available")
      ).not.toBeInTheDocument();
    });

    it("shows 'available' when a different username is available", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({ available: true }),
      });

      renderForm({ username: "testuser" });

      const input = screen.getByPlaceholderText("your_username");
      await userEvent.clear(input);
      await userEvent.type(input, "newname");

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(350);

      await waitFor(() => {
        expect(screen.getByText("Username is available")).toBeInTheDocument();
      });
    });

    it("shows 'taken' for taken usernames", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({ available: false }),
      });

      renderForm({ username: "testuser" });

      const input = screen.getByPlaceholderText("your_username");
      await userEvent.clear(input);
      await userEvent.type(input, "takenname");

      await vi.advanceTimersByTimeAsync(350);

      await waitFor(() => {
        expect(
          screen.getByText("Username is already taken")
        ).toBeInTheDocument();
      });
    });

    it("shows invalid message for bad format", async () => {
      renderForm({ username: "testuser" });

      const input = screen.getByPlaceholderText("your_username");
      await userEvent.clear(input);
      await userEvent.type(input, "ab");

      await waitFor(() => {
        expect(
          screen.getByText(
            /3–30 characters, letters, numbers, and underscores only/
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("public profile link", () => {
    it("shows the public profile link when user has a username", () => {
      renderForm({ username: "testuser" });

      const link = screen.getByRole("link", {
        name: /view public profile/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/testuser");
    });

    it("does not show the public profile link when user has no username", () => {
      renderForm({ username: null });

      expect(
        screen.queryByRole("link", { name: /view public profile/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("share profile button", () => {
    it("shows share button when user has a username", () => {
      renderForm({ username: "testuser" });

      expect(
        screen.getByRole("button", { name: "Share Profile" })
      ).toBeInTheDocument();
    });

    it("does not show share button when user has no username", () => {
      renderForm({ username: null });

      expect(
        screen.queryByRole("button", { name: "Share Profile" })
      ).not.toBeInTheDocument();
    });

    it("copies profile URL to clipboard on click", async () => {
      renderForm({ username: "testuser" });

      const shareBtn = screen.getByRole("button", { name: "Share Profile" });
      await userEvent.click(shareBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/testuser")
      );
    });

    it("shows 'Copied!' text after clicking share", async () => {
      renderForm({ username: "testuser" });

      const shareBtn = screen.getByRole("button", { name: "Share Profile" });
      await userEvent.click(shareBtn);

      expect(screen.getByText("Copied!")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Share Profile" })
      ).not.toBeInTheDocument();
    });

    it("reverts 'Copied!' back to 'Share Profile' after 2 seconds", async () => {
      renderForm({ username: "testuser" });

      const shareBtn = screen.getByRole("button", { name: "Share Profile" });
      await userEvent.click(shareBtn);

      expect(screen.getByText("Copied!")).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(2100);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Share Profile" })
        ).toBeInTheDocument();
      });
    });
  });
});
