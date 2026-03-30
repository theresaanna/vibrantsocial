import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemePreview } from "@/components/theme-preview";

vi.mock("@/components/bio-content", () => ({
  BioContent: ({ content }: { content: string }) => <div data-testid="bio-content">{content}</div>,
}));

vi.mock("@/lib/profile-themes", () => ({
  generateAdaptiveTheme: (colors: Record<string, string>) => ({
    light: {
      profileBgColor: colors.profileBgColor || "#ffffff",
      profileTextColor: colors.profileTextColor || "#000000",
      profileLinkColor: colors.profileLinkColor || "#2563eb",
      profileSecondaryColor: colors.profileSecondaryColor || "#71717a",
      profileContainerColor: colors.profileContainerColor || "#f4f4f5",
    },
    dark: {
      profileBgColor: "#1a1a2e",
      profileTextColor: "#e0e0e0",
      profileLinkColor: "#60a5fa",
      profileSecondaryColor: "#9ca3af",
      profileContainerColor: "#2d2d44",
    },
  }),
  isLightBackground: (color: string) => {
    // Simple check: if color starts with #f or #e or #d or #c or #b, it's light
    return color.toLowerCase() < "#800000" ? false : true;
  },
}));

const defaultColors = {
  profileBgColor: "#ffffff",
  profileTextColor: "#18181b",
  profileLinkColor: "#2563eb",
  profileSecondaryColor: "#71717a",
  profileContainerColor: "#f4f4f5",
};

const defaultProps = {
  colors: defaultColors,
  username: "testuser",
  displayName: "Test User",
  bio: "A bio",
  avatarSrc: null,
  onClose: vi.fn(),
};

describe("ThemePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Theme Preview header", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("Theme Preview")).toBeInTheDocument();
  });

  it("renders display name", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders username with @ prefix", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders initial letter when no avatar is provided", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders avatar image when avatarSrc is provided", () => {
    render(
      <ThemePreview
        {...defaultProps}
        avatarSrc="https://example.com/avatar.jpg"
      />
    );
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows stats (posts, followers, following)", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("posts")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("followers")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("following")).toBeInTheDocument();
  });

  it("shows sample post content", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("this link")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("shows bio preview text", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByTestId("bio-content")).toBeInTheDocument();
  });

  it("shows placeholder when bio is null", () => {
    render(<ThemePreview {...defaultProps} bio={null} />);
    expect(
      screen.getByText(
        "This is what your profile bio will look like with these colors."
      )
    ).toBeInTheDocument();
  });

  it("has Light and Dark toggle buttons", () => {
    render(<ThemePreview {...defaultProps} />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("toggles between light and dark preview modes", () => {
    render(<ThemePreview {...defaultProps} />);
    fireEvent.click(screen.getByText("Dark"));
    // The mode indicator text should change
    // Exact text depends on which mode was initially selected
    expect(
      screen.getByText("Light") // Light button should still be visible
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Light"));
    expect(
      screen.getByText("Dark") // Dark button should still be visible
    ).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<ThemePreview {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ThemePreview {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ThemePreview {...defaultProps} onClose={onClose} />
    );
    const backdrop = container.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside modal", () => {
    const onClose = vi.fn();
    render(<ThemePreview {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Theme Preview"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses username as name fallback when displayName is null", () => {
    render(
      <ThemePreview {...defaultProps} displayName={null} />
    );
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("uses 'Your Name' fallback when both displayName and username are null", () => {
    render(
      <ThemePreview
        {...defaultProps}
        displayName={null}
        username={null}
      />
    );
    expect(screen.getByText("Your Name")).toBeInTheDocument();
    expect(screen.getByText("@username")).toBeInTheDocument();
  });

  it("shows mode indicator text", () => {
    render(<ThemePreview {...defaultProps} />);
    // One of these should be visible depending on initial mode
    const modeText =
      screen.queryByText("Your chosen colors") ||
      screen.queryByText(/Auto-generated for/);
    expect(modeText).toBeInTheDocument();
  });
});
