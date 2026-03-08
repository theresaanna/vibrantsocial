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

// Mock ThemeEditor
vi.mock("@/components/theme-editor", () => ({
  ThemeEditor: () => <div data-testid="theme-editor" />,
}));

const defaultUser = {
  id: "user1",
  username: "testuser",
  displayName: "Test User",
  bio: null,
  profileBgColor: null as string | null,
  profileTextColor: null as string | null,
  profileLinkColor: null as string | null,
  profileSecondaryColor: null as string | null,
  profileContainerColor: null as string | null,
};

interface RenderFormOptions {
  userOverrides?: Partial<typeof defaultUser>;
  emailOnComment?: boolean;
  emailOnNewChat?: boolean;
  emailOnMention?: boolean;
  emailOnFriendRequest?: boolean;
  biometricVerified?: boolean;
  showGraphicByDefault?: boolean;
  showNsfwContent?: boolean;
  pushEnabled?: boolean;
  isProfilePublic?: boolean;
  phoneVerified?: boolean;
  phoneNumber?: string | null;
  isCredentialsUser?: boolean;
}

function renderForm(options: RenderFormOptions = {}) {
  const {
    userOverrides = {},
    emailOnComment = true,
    emailOnNewChat = true,
    emailOnMention = true,
    emailOnFriendRequest = true,
    biometricVerified = false,
    showGraphicByDefault = false,
    showNsfwContent = false,
    pushEnabled = false,
    isProfilePublic = true,
    phoneVerified = false,
    phoneNumber = null,
    isCredentialsUser = false,
  } = options;
  return render(
    <ProfileForm
      user={{ ...defaultUser, ...userOverrides }}
      currentAvatar={null}
      oauthImage={null}
      biometricVerified={biometricVerified}
      showGraphicByDefault={showGraphicByDefault}
      showNsfwContent={showNsfwContent}
      emailOnComment={emailOnComment}
      emailOnNewChat={emailOnNewChat}
      emailOnMention={emailOnMention}
      emailOnFriendRequest={emailOnFriendRequest}
      pushEnabled={pushEnabled}
      isProfilePublic={isProfilePublic}
      phoneVerified={phoneVerified}
      phoneNumber={phoneNumber}
      isCredentialsUser={isCredentialsUser}
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

  it("renders the theme editor", () => {
    renderForm();
    expect(screen.getByTestId("theme-editor")).toBeInTheDocument();
  });

  describe("username status - no 'available' message for current username", () => {
    it("does not show 'available' when username matches the saved username", () => {
      renderForm({ userOverrides: { username: "testuser" } });

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

      renderForm({ userOverrides: { username: "testuser" } });

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

      renderForm({ userOverrides: { username: "testuser" } });

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
      renderForm({ userOverrides: { username: "testuser" } });

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
      renderForm({ userOverrides: { username: "testuser" } });

      const link = screen.getByRole("link", {
        name: /view public profile/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/testuser");
    });

    it("does not show the public profile link when user has no username", () => {
      renderForm({ userOverrides: { username: null } });

      expect(
        screen.queryByRole("link", { name: /view public profile/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("share profile button", () => {
    it("shows share button when user has a username", () => {
      renderForm({ userOverrides: { username: "testuser" } });

      expect(
        screen.getByRole("button", { name: "Share Profile" })
      ).toBeInTheDocument();
    });

    it("does not show share button when user has no username", () => {
      renderForm({ userOverrides: { username: null } });

      expect(
        screen.queryByRole("button", { name: "Share Profile" })
      ).not.toBeInTheDocument();
    });

    it("copies profile URL to clipboard on click", async () => {
      renderForm({ userOverrides: { username: "testuser" } });

      const shareBtn = screen.getByRole("button", { name: "Share Profile" });
      await userEvent.click(shareBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/testuser")
      );
    });

    it("shows 'Copied!' text after clicking share", async () => {
      renderForm({ userOverrides: { username: "testuser" } });

      const shareBtn = screen.getByRole("button", { name: "Share Profile" });
      await userEvent.click(shareBtn);

      expect(screen.getByText("Copied!")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Share Profile" })
      ).not.toBeInTheDocument();
    });

    it("reverts 'Copied!' back to 'Share Profile' after 2 seconds", async () => {
      renderForm({ userOverrides: { username: "testuser" } });

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

  describe("email notification toggles", () => {
    it("renders all three email notification checkboxes", () => {
      renderForm();
      expect(screen.getByLabelText("New comments on my posts")).toBeInTheDocument();
      expect(screen.getByLabelText("New chat conversations")).toBeInTheDocument();
      expect(screen.getByLabelText("Mentions in posts and comments")).toBeInTheDocument();
    });

    it("checks mention toggle when emailOnMention is true", () => {
      renderForm({ emailOnMention: true });
      const checkbox = screen.getByLabelText("Mentions in posts and comments");
      expect(checkbox).toBeChecked();
    });

    it("unchecks mention toggle when emailOnMention is false", () => {
      renderForm({ emailOnMention: false });
      const checkbox = screen.getByLabelText("Mentions in posts and comments");
      expect(checkbox).not.toBeChecked();
    });

    it("toggles mention checkbox on click", async () => {
      renderForm({ emailOnMention: false });
      const checkbox = screen.getByLabelText("Mentions in posts and comments");
      expect(checkbox).not.toBeChecked();
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });
});
