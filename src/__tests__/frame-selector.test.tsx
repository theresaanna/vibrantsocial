import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FrameSelector } from "@/components/frame-selector";

// Mock FramedAvatar to avoid nested frame-lookup issues
vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ src, initial, size, frameId }: { src: string | null; initial: string; size: number; frameId?: string | null }) => (
    <div data-testid={`framed-avatar-${size}`} data-frame-id={frameId ?? ""}>
      {src ? <img src={src} alt="" /> : <span>{initial}</span>}
    </div>
  ),
}));

describe("FrameSelector", () => {
  const defaultProps = {
    currentFrameId: null,
    avatarSrc: "https://example.com/avatar.jpg",
    initial: "T",
    isPremium: true,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 8 frame options for premium users", () => {
    render(<FrameSelector {...defaultProps} />);
    // 3 spring + 5 neon = 8
    expect(screen.getByTestId("frame-option-spring-1")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-spring-2")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-spring-3")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-neon-1")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-neon-2")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-neon-3")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-neon-4")).toBeInTheDocument();
    expect(screen.getByTestId("frame-option-neon-5")).toBeInTheDocument();
  });

  it("shows upgrade prompt for free users", () => {
    render(<FrameSelector {...defaultProps} isPremium={false} />);
    expect(screen.getByTestId("frame-upgrade-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("frame-option-spring-1")).not.toBeInTheDocument();
  });

  it("calls onSelect with frame ID when a frame option is clicked", () => {
    render(<FrameSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frame-option-neon-2"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("neon-2");
  });

  it("calls onSelect with null when 'No Frame' is clicked", () => {
    render(<FrameSelector {...defaultProps} currentFrameId="spring-1" />);
    fireEvent.click(screen.getByTestId("frame-option-none"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(null);
  });

  it("renders live preview", () => {
    render(<FrameSelector {...defaultProps} />);
    expect(screen.getByTestId("frame-preview")).toBeInTheDocument();
  });

  it("updates preview when a frame is selected", () => {
    render(<FrameSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frame-option-neon-3"));
    // The preview avatar should now have the selected frameId
    const preview = screen.getByTestId("frame-preview").querySelector('[data-testid="framed-avatar-96"]');
    expect(preview).toHaveAttribute("data-frame-id", "neon-3");
  });

  it("calls onClose when close button is clicked", () => {
    render(<FrameSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frame-selector-close"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<FrameSelector {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frame-selector-backdrop"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows 'No Frame' as selected when currentFrameId is null", () => {
    render(<FrameSelector {...defaultProps} currentFrameId={null} />);
    const noneBtn = screen.getByTestId("frame-option-none");
    expect(noneBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("shows category headings", () => {
    render(<FrameSelector {...defaultProps} />);
    expect(screen.getByText("Spring")).toBeInTheDocument();
    expect(screen.getByText("Neon")).toBeInTheDocument();
  });
});
