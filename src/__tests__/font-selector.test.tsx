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

  it("renders the font selector section", () => {
    render(<FontSelector {...defaultProps} />);
    expect(screen.getByTestId("font-selector")).toBeInTheDocument();
    expect(screen.getByText("Username Font")).toBeInTheDocument();
  });

  it("renders the font preview with display name", () => {
    render(<FontSelector {...defaultProps} />);
    expect(screen.getByTestId("font-preview")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders the default Lexend option", () => {
    render(<FontSelector {...defaultProps} />);
    expect(screen.getByTestId("font-option-default")).toBeInTheDocument();
    expect(screen.getByText("Lexend (Default)")).toBeInTheDocument();
  });

  it("default option is selected when currentFontId is null", () => {
    render(<FontSelector {...defaultProps} />);
    const defaultBtn = screen.getByTestId("font-option-default");
    expect(defaultBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders free font options", () => {
    render(<FontSelector {...defaultProps} />);
    expect(screen.getByTestId("font-option-sofadi-one")).toBeInTheDocument();
    expect(screen.getByTestId("font-option-jersey-10")).toBeInTheDocument();
  });

  it("renders premium font options", () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
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
    await userEvent.click(screen.getByTestId("font-option-sofadi-one"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("sofadi-one");
  });

  it("calls onSelect with null when default is clicked", async () => {
    render(<FontSelector {...defaultProps} currentFontId="sofadi-one" />);
    await userEvent.click(screen.getByTestId("font-option-default"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(null);
  });

  it("shows selected state for current font", () => {
    render(<FontSelector {...defaultProps} currentFontId="jersey-10" />);
    const jerseyBtn = screen.getByTestId("font-option-jersey-10");
    expect(jerseyBtn).toHaveAttribute("aria-pressed", "true");
    const defaultBtn = screen.getByTestId("font-option-default");
    expect(defaultBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("disables premium fonts for free users", () => {
    render(<FontSelector {...defaultProps} isPremium={false} />);
    const gugiBtn = screen.getByTestId("font-option-gugi");
    expect(gugiBtn).toBeDisabled();
  });

  it("enables premium fonts for premium users", () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
    const gugiBtn = screen.getByTestId("font-option-gugi");
    expect(gugiBtn).not.toBeDisabled();
  });

  it("shows upgrade prompt for free users", () => {
    render(<FontSelector {...defaultProps} isPremium={false} />);
    expect(screen.getByTestId("font-upgrade-prompt")).toBeInTheDocument();
  });

  it("does not show upgrade prompt for premium users", () => {
    render(<FontSelector {...defaultProps} isPremium={true} />);
    expect(screen.queryByTestId("font-upgrade-prompt")).not.toBeInTheDocument();
  });

  it("shows 'Your Name' when displayName is empty", () => {
    render(<FontSelector {...defaultProps} displayName="" />);
    expect(screen.getByText("Your Name")).toBeInTheDocument();
  });

  it("premium user can select premium font", async () => {
    const onSelect = vi.fn();
    render(<FontSelector {...defaultProps} isPremium={true} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("font-option-gugi"));
    expect(onSelect).toHaveBeenCalledWith("gugi");
  });
});
