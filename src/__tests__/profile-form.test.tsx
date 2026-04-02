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

// Mock account linking actions
vi.mock("@/app/profile/account-linking-actions", () => ({
  linkAccount: vi.fn(),
  unlinkAccount: vi.fn(),
  switchAccount: vi.fn(),
  getLinkedAccounts: vi.fn().mockResolvedValue([]),
}));

// Mock server actions
const mockResendVerificationEmail = vi.fn().mockResolvedValue({ success: true, message: "Verification email sent" });
vi.mock("@/app/profile/actions", () => ({
  updateProfile: vi.fn(),
  removeAvatar: vi.fn(),
  requestEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
  deleteAccount: vi.fn(),
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

// Mock FontSelector
vi.mock("@/components/font-selector", () => ({
  FontSelector: ({ onSelect }: { onSelect: (id: string | null) => void }) => (
    <div data-testid="font-selector">
      <button data-testid="mock-font-select" onClick={() => onSelect("sofadi-one")}>Select Font</button>
    </div>
  ),
}));

const defaultUser = {
  id: "user1",
  username: "testuser" as string | null,
  displayName: "Test User",
  bio: null,
  profileBgColor: null as string | null,
  profileTextColor: null as string | null,
  profileLinkColor: null as string | null,
  profileSecondaryColor: null as string | null,
  profileContainerColor: null as string | null,
  profileFrameId: null as string | null,
  profileBgImage: null as string | null,
  profileBgRepeat: null as string | null,
  profileBgAttachment: null as string | null,
  profileBgSize: null as string | null,
  profileBgPosition: null as string | null,
  sparklefallEnabled: false,
  sparklefallPreset: null as string | null,
  sparklefallSparkles: null as string | null,
  sparklefallColors: null as string | null,
  sparklefallInterval: null as number | null,
  sparklefallWind: null as number | null,
  sparklefallMaxSparkles: null as number | null,
  sparklefallMinSize: null as number | null,
  sparklefallMaxSize: null as number | null,
  usernameFont: null as string | null,
};

interface RenderFormOptions {
  userOverrides?: Partial<typeof defaultUser>;
  email?: string | null;
  emailVerified?: boolean;
  pendingEmail?: string | null;
  emailOnComment?: boolean;
  emailOnNewChat?: boolean;
  emailOnMention?: boolean;
  emailOnFriendRequest?: boolean;
  emailOnSubscribedPost?: boolean;
  emailOnTagPost?: boolean;
  ageVerified?: boolean;
  showGraphicByDefault?: boolean;
  showNsfwContent?: boolean;
  hideSensitiveOverlay?: boolean;
  hideNsfwOverlay?: boolean;
  pushEnabled?: boolean;
  isProfilePublic?: boolean;
  phoneVerified?: boolean;
  phoneNumber?: string | null;
  isCredentialsUser?: boolean;
  isPremium?: boolean;
  stars?: number;
}

function renderForm(options: RenderFormOptions = {}) {
  const {
    userOverrides = {},
    email = null,
    emailVerified = true,
    pendingEmail = null,
    emailOnComment = true,
    emailOnNewChat = true,
    emailOnMention = true,
    emailOnFriendRequest = true,
    emailOnSubscribedPost = true,
    emailOnTagPost = true,
    ageVerified = false,
    showGraphicByDefault = false,
    showNsfwContent = false,
    hideSensitiveOverlay = false,
    hideNsfwOverlay = false,
    pushEnabled = false,
    isProfilePublic = true,
    phoneVerified = false,
    phoneNumber = null,
    isCredentialsUser = false,
    isPremium = true,
    stars = 0,
  } = options;
  return render(
    <ProfileForm
      user={{ ...defaultUser, ...userOverrides }}
      email={email}
      emailVerified={emailVerified}
      pendingEmail={pendingEmail}
      currentAvatar={null}
      oauthImage={null}
      ageVerified={ageVerified}
      showGraphicByDefault={showGraphicByDefault}
      showNsfwContent={showNsfwContent}
      hideSensitiveOverlay={hideSensitiveOverlay}
      hideNsfwOverlay={hideNsfwOverlay}
      emailOnComment={emailOnComment}
      emailOnNewChat={emailOnNewChat}
      emailOnMention={emailOnMention}
      emailOnFriendRequest={emailOnFriendRequest}
      emailOnSubscribedPost={emailOnSubscribedPost}
      emailOnTagPost={emailOnTagPost}
      pushEnabled={pushEnabled}
      isProfilePublic={isProfilePublic}
      phoneVerified={phoneVerified}
      phoneNumber={phoneNumber}
      isCredentialsUser={isCredentialsUser}
      isPremium={isPremium}
      stars={stars}
      backgrounds={[{ id: "test-bg", name: "Test Background", src: "/backgrounds/test.jpg" }]}
      userEmail="test@example.com"
      customPresets={[]}
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

  describe("theme editor gating", () => {
    it("always renders the theme editor (presets available to all)", () => {
      renderForm({ isPremium: false });
      expect(screen.getByTestId("theme-editor")).toBeInTheDocument();
    });

    it("renders the theme editor for premium users", () => {
      renderForm({ isPremium: true });
      expect(screen.getByTestId("theme-editor")).toBeInTheDocument();
    });
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

  describe("email address section", () => {
    it("shows the Email Address heading", () => {
      renderForm();
      expect(screen.getByText("Email Address")).toBeInTheDocument();
    });

    it("shows verified email when user has email and no pending", () => {
      renderForm({ email: "user@example.com" });
      expect(
        screen.getByText("Verified: user@example.com")
      ).toBeInTheDocument();
    });

    it("does not show verified text when no email", () => {
      renderForm({ email: null });
      expect(screen.queryByText(/Verified:/)).not.toBeInTheDocument();
    });

    it("shows pending email status when pendingEmail exists", () => {
      renderForm({
        email: "old@example.com",
        pendingEmail: "new@example.com",
      });
      expect(
        screen.getByText("Verification sent to new@example.com")
      ).toBeInTheDocument();
    });

    it("hides verified text when pendingEmail exists", () => {
      renderForm({
        email: "old@example.com",
        pendingEmail: "new@example.com",
      });
      expect(screen.queryByText(/Verified:/)).not.toBeInTheDocument();
    });

    it("shows cancel button when pendingEmail exists", () => {
      renderForm({ pendingEmail: "new@example.com" });
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeInTheDocument();
    });

    it("does not show cancel button when no pendingEmail", () => {
      renderForm({ pendingEmail: null });
      expect(
        screen.queryByRole("button", { name: "Cancel" })
      ).not.toBeInTheDocument();
    });

    it("shows resend button when pendingEmail exists", () => {
      renderForm({ pendingEmail: "new@example.com" });
      expect(
        screen.getByRole("button", { name: "Resend" })
      ).toBeInTheDocument();
    });

    it("shows unverified status with resend button when email exists but not verified", () => {
      renderForm({ email: "user@example.com", emailVerified: false });
      expect(
        screen.getByText("Not verified: user@example.com")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Resend verification" })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Verified:/)).not.toBeInTheDocument();
    });

    it("does not show unverified status when email is verified", () => {
      renderForm({ email: "user@example.com", emailVerified: true });
      expect(screen.queryByText(/Not verified:/)).not.toBeInTheDocument();
      expect(
        screen.getByText("Verified: user@example.com")
      ).toBeInTheDocument();
    });

    it("calls resendVerificationEmail and shows confirmation when resend clicked", async () => {
      const user = userEvent.setup();
      renderForm({ email: "user@example.com", emailVerified: false });

      await user.click(screen.getByRole("button", { name: "Resend verification" }));

      await waitFor(() => {
        expect(mockResendVerificationEmail).toHaveBeenCalled();
        expect(screen.getByText("Verification email sent")).toBeInTheDocument();
      });
    });

    it("calls resendVerificationEmail when resend clicked on pending email", async () => {
      const user = userEvent.setup();
      renderForm({ pendingEmail: "new@example.com" });

      await user.click(screen.getByRole("button", { name: "Resend" }));

      await waitFor(() => {
        expect(mockResendVerificationEmail).toHaveBeenCalled();
        expect(screen.getByText("Verification email sent")).toBeInTheDocument();
      });
    });

    it("shows email input field", () => {
      renderForm();
      expect(
        screen.getByPlaceholderText("you@example.com")
      ).toBeInTheDocument();
    });

    it("pre-fills email input with current email", () => {
      renderForm({ email: "user@example.com" });
      const input = screen.getByPlaceholderText("you@example.com");
      expect(input).toHaveValue("user@example.com");
    });

    it("shows Add button when no email", () => {
      renderForm({ email: null });
      expect(
        screen.getByRole("button", { name: "Add" })
      ).toBeInTheDocument();
    });

    it("shows Update button when email exists", () => {
      renderForm({ email: "user@example.com" });
      expect(
        screen.getByRole("button", { name: "Update" })
      ).toBeInTheDocument();
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

  describe("stars display", () => {
    it("displays stars count on profile", () => {
      renderForm({ userOverrides: { username: "testuser" }, stars: 42 });
      const starsEl = screen.getByTestId("stars-count");
      expect(starsEl).toBeInTheDocument();
      expect(starsEl).toHaveTextContent("42 stars");
    });

    it("uses singular 'star' for count of 1", () => {
      renderForm({ userOverrides: { username: "testuser" }, stars: 1 });
      expect(screen.getByTestId("stars-count")).toHaveTextContent("1 star");
    });

    it("shows 0 stars by default", () => {
      renderForm({ userOverrides: { username: "testuser" } });
      expect(screen.getByTestId("stars-count")).toHaveTextContent("0 stars");
    });
  });
});
