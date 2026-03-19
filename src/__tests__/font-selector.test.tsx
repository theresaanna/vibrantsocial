import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FontSelector } from "@/components/font-selector";

// Mock the PremiumCrown component
vi.mock("@/components/premium-crown", () => ({
  PremiumCrown: () => <span data-testid="premium-crown" />,
}));

describe("FontSelector", () => {
  const defaultProps = {
    currentFontId: null,
    displayName: "Test User",
    isPremium: false,
    userEmail: "test@example.com",
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function expand() {
    await userEvent.click(screen.getByTestId("font-selector-toggle"));
  }

  it("renders the font selector section collapsed by default", () => {
    render(<FontSelector {...defaultProps} />);
    expect(screen.getByTestId("font-selector")).toBeInTheDocument();
    expect(screen.getByText("Username Font")).toBeInTheDocument();
    // Content should not be visible when collapsed
    expect(screen.queryByTestId("font-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("font-option-default")).not.toBeInTheDocument();
  });

  it("expands when toggle is clicked", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    expect(screen.getByTestId("font-preview")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-default")).toBeInTheDocument();
  });

  it("shows current font name in header when a font is selected", () => {
    render(<FontSelector {...defaultProps} currentFontId="sofadi-one" />);
    expect(screen.getByText("(Sofadi One)")).toBeInTheDocument();
  });

  it("renders the font preview with display name", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    expect(screen.getByTestId("font-preview")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders the default Lexend option", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    expect(screen.getByTestId("font-option-default")).toBeInTheDocument();
    expect(screen.getByText("Lexend (Default)")).toBeInTheDocument();
  });

  it("default option is selected when currentFontId is null", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    const defaultBtn = screen.getByTestId("font-option-default");
    expect(defaultBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders free font options", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    expect(screen.getByTestId("font-option-sofadi-one")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-jersey-10")).toBeInTheDocument();
  });

  it("renders premium font options", async () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
    await expand();
    expect(screen.getByTestId("font-option-gugi")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-turret-road")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-nova-mono")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-ewert")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-ballet")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-rubik-puddles")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-jacquard-24")).toBeInTheDocument();
  });

  it("calls onSelect with font id when a font is clicked", async () => {
    render(<FontSelector {...defaultProps} />);
    await expand();
    await userEvent.click(screen.getByTestId("font-option-sofadi-one"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("sofadi-one");
  });

  it("calls onSelect with null when default is clicked", async () => {
    render(<FontSelector {...defaultProps} currentFontId="sofadi-one" />);
    await expand();
    await userEvent.click(screen.getByTestId("font-option-default"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(null);
  });

  it("shows selected state for current font", async () => {
    render(<FontSelector {...defaultProps} currentFontId="jersey-10" />);
    await expand();
    const jerseyBtn = screen.getByTestId("font-option-jersey-10");
    expect(jerseyBtn).toHaveAttribute("aria-pressed", "true");
    const defaultBtn = screen.getByTestId("font-option-default");
    expect(defaultBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("disables premium fonts for free users", async () => {
    render(<FontSelector {...defaultProps} isPremium={false} />);
    await expand();
    const gugiBtn = screen.getByTestId("font-option-gugi");
    expect(gugiBtn).toBeDisabled();
  });

  it("enables premium fonts for premium users", async () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
    await expand();
    const gugiBtn = screen.getByTestId("font-option-gugi");
    expect(gugiBtn).not.toBeDisabled();
  });

  it("shows upgrade prompt for free users", async () => {
    render(<FontSelector {...defaultProps} isPremium={false} />);
    await expand();
    expect(screen.getByTestId("font-upgrade-prompt")).toBeInTheDocument();
  });

  it("does not show upgrade prompt for premium users", async () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
    await expand();
    expect(screen.queryByTestId("font-upgrade-prompt")).not.toBeInTheDocument();
  });

  it("shows 'Your Name' when displayName is empty", async () => {
    render(<FontSelector {...defaultProps} displayName="" />);
    await expand();
    expect(screen.getByText("Your Name")).toBeInTheDocument();
  });

  it("premium user can select premium font", async () => {
    const onSelect = vi.fn();
    render(<FontSelector {...defaultProps} isPremium={true} onSelect={onSelect} />);
    await expand();
    await userEvent.click(screen.getByTestId("font-option-gugi"));
    expect(onSelect).toHaveBeenCalledWith("gugi");
  });
});
