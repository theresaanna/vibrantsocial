import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileForm } from "@/app/profile/profile-form";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ update: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/app/profile/actions", () => ({
  updateProfile: vi.fn(),
  removeAvatar: vi.fn(),
  requestEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
}));
vi.mock("@/app/profile/account-linking-actions", () => ({
  linkAccount: vi.fn(),
  unlinkAccount: vi.fn(),
  switchAccount: vi.fn(),
  getLinkedAccounts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/font-selector", () => ({
  FontSelector: () => <div data-testid="font-selector" />,
}));
vi.mock("@/components/frame-selector", () => ({
  FrameSelector: () => <div data-testid="frame-selector" />,
}));
vi.mock("@/components/background-editor", () => ({
  BackgroundEditor: () => <div data-testid="background-editor" />,
}));
vi.mock("@/components/sparkle-editor", () => ({
  SparkleEditor: () => <div data-testid="sparkle-editor" />,
}));
vi.mock("@/components/theme-editor", () => ({
  ThemeEditor: () => <div data-testid="theme-editor" />,
}));
vi.mock("@/components/push-notification-toggle", () => ({
  PushNotificationToggle: () => <div data-testid="push-toggle" />,
}));
vi.mock("@/components/bio-editor", () => ({
  BioEditor: () => <div data-testid="bio-editor"><input type="hidden" name="bio" value="" /></div>,
}));
vi.mock("@/components/avatar-cropper-modal", () => ({
  AvatarCropperModal: () => null,
}));
vi.mock("@/components/link-account-modal", () => ({
  LinkAccountModal: () => null,
}));

const defaultUser = {
  id: "u1",
  username: "testuser",
  displayName: "Test User",
  bio: "hello",
  avatar: null,
  image: null,
  usernameFont: null,
  profileFrameId: null,
  profileBgColor: null,
  profileTextColor: null,
  profileLinkColor: null,
  profileSecondaryColor: null,
  profileContainerColor: null,
  profileBgImage: null,
  profileBgRepeat: null,
  profileBgAttachment: null,
  profileBgSize: null,
  profileBgPosition: null,
  sparklefallEnabled: false,
  sparklefallPreset: null,
  sparklefallSparkles: null,
  sparklefallColors: null,
  sparklefallInterval: null,
  sparklefallWind: null,
  sparklefallMaxSparkles: null,
  sparklefallMinSize: null,
  sparklefallMaxSize: null,
  passwordHash: null,
};

const baseFormProps = {
  user: defaultUser,
  email: "test@example.com" as string | null,
  pendingEmail: null as string | null,
  currentAvatar: null as string | null,
  oauthImage: null as string | null,
  ageVerified: false,
  showGraphicByDefault: false,
  showNsfwContent: false,
  hideSensitiveOverlay: false,
  emailOnComment: true,
  emailOnNewChat: true,
  emailOnMention: true,
  emailOnFriendRequest: true,
  emailOnSubscribedPost: true,
  emailOnTagPost: true,
  pushEnabled: false,
  isProfilePublic: true,
  hideWallFromFeed: false,
  phoneVerified: false,
  phoneNumber: null as string | null,
  isCredentialsUser: false,
  birthdayMonth: null as number | null,
  birthdayDay: null as number | null,
  isPremium: false,
  stars: 0,
  starsSpent: 0,
  referralCode: "abc123",
  backgrounds: [],
  userEmail: "test@example.com" as string | null,
  customPresets: [],
  emailVerified: true,
  premiumBackgrounds: [],
};

describe("Profile form - overlay opt-in settings", () => {
  it("shows NSFW toggle with updated description mentioning overlay", () => {
    render(<ProfileForm {...baseFormProps} />);
    expect(screen.getByText("Show NSFW content in feed")).toBeInTheDocument();
    expect(screen.getByText(/click-to-reveal overlay will still be shown/)).toBeInTheDocument();
  });

  it("does not show sensitive or graphic overlay toggles when not age verified", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={false} />);
    expect(screen.queryByText("Hide overlay on Sensitive content")).not.toBeInTheDocument();
    expect(screen.queryByText("Hide overlay on Graphic/Explicit content")).not.toBeInTheDocument();
  });

  it("shows sensitive overlay toggle when age verified", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} />);
    expect(screen.getByText("Hide overlay on Sensitive content")).toBeInTheDocument();
    expect(screen.getByText(/Sensitive posts will be visible without clicking to reveal/)).toBeInTheDocument();
  });

  it("shows graphic overlay toggle when age verified", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} />);
    expect(screen.getByText("Hide overlay on Graphic/Explicit content")).toBeInTheDocument();
    expect(screen.getByText(/Graphic\/Explicit posts will be visible without clicking to reveal/)).toBeInTheDocument();
  });

  it("sensitive overlay checkbox reflects hideSensitiveOverlay prop", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} hideSensitiveOverlay={true} hideNsfwOverlay={false} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Sensitive content/i });
    expect(checkbox).toBeChecked();
  });

  it("sensitive overlay checkbox is unchecked by default", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} hideSensitiveOverlay={false} hideNsfwOverlay={false} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Sensitive content/i });
    expect(checkbox).not.toBeChecked();
  });

  it("graphic overlay checkbox reflects showGraphicByDefault prop", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} showGraphicByDefault={true} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Graphic\/Explicit content/i });
    expect(checkbox).toBeChecked();
  });

  it("graphic overlay checkbox is unchecked by default", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} showGraphicByDefault={false} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Graphic\/Explicit content/i });
    expect(checkbox).not.toBeChecked();
  });

  it("hideSensitiveOverlay checkbox has correct name attribute for form submission", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Sensitive content/i });
    expect(checkbox).toHaveAttribute("name", "hideSensitiveOverlay");
  });

  it("showGraphicByDefault checkbox has correct name attribute for form submission", () => {
    render(<ProfileForm {...baseFormProps} ageVerified={true} />);
    const checkbox = screen.getByRole("checkbox", { name: /Hide overlay on Graphic\/Explicit content/i });
    expect(checkbox).toHaveAttribute("name", "showGraphicByDefault");
  });
});
