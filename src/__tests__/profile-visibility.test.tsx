import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileForm } from "@/app/profile/profile-form";

// ── Mocks for ProfileForm UI tests ───────────────────────

const mockUpdate = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => ({ update: mockUpdate }),
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

vi.mock("@/app/profile/actions", () => ({
  updateProfile: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock("@/components/bio-editor", () => ({
  BioEditor: ({ initialContent }: { initialContent?: string | null }) => (
    <div data-testid="bio-editor">
      <input type="hidden" name="bio" value={initialContent ?? ""} />
    </div>
  ),
}));

vi.mock("@/components/theme-editor", () => ({
  ThemeEditor: () => <div data-testid="theme-editor" />,
}));

// ── Helpers ──────────────────────────────────────────────

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
  isProfilePublic?: boolean;
}

function renderForm(options: RenderFormOptions = {}) {
  const { isProfilePublic = true } = options;
  return render(
    <ProfileForm
      user={defaultUser}
      currentAvatar={null}
      oauthImage={null}
      ageVerified={false}
      showGraphicByDefault={false}
      showNsfwContent={false}
      emailOnComment={true}
      emailOnNewChat={true}
      emailOnMention={true}
      emailOnFriendRequest={true}
      pushEnabled={false}
      isProfilePublic={isProfilePublic}
      phoneVerified={false}
      phoneNumber={null}
      isCredentialsUser={false}
    />
  );
}

// ── Tests ────────────────────────────────────────────────

describe("Profile Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("ProfileForm toggle", () => {
    it("renders the Public profile checkbox", () => {
      renderForm();
      expect(screen.getByLabelText("Public profile")).toBeInTheDocument();
    });

    it("checkbox is checked when isProfilePublic is true", () => {
      renderForm({ isProfilePublic: true });
      expect(screen.getByLabelText("Public profile")).toBeChecked();
    });

    it("checkbox is unchecked when isProfilePublic is false", () => {
      renderForm({ isProfilePublic: false });
      expect(screen.getByLabelText("Public profile")).not.toBeChecked();
    });

    it("shows the description text", () => {
      renderForm();
      expect(
        screen.getByText(
          "When disabled, only logged-in users can view your profile and posts."
        )
      ).toBeInTheDocument();
    });

    it("can be toggled by clicking", async () => {
      renderForm({ isProfilePublic: true });
      const checkbox = screen.getByLabelText("Public profile");
      expect(checkbox).toBeChecked();

      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it("checkbox has correct name and value for form submission", () => {
      renderForm({ isProfilePublic: true });
      const checkbox = screen.getByLabelText("Public profile") as HTMLInputElement;
      expect(checkbox).toHaveAttribute("name", "isProfilePublic");
      expect(checkbox).toHaveAttribute("value", "true");
    });
  });
});
