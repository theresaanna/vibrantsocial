import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NsfwToggle } from "@/components/nsfw-toggle";

const mockToggleNsfwContent = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "u1" } },
    status: "authenticated",
  }),
}));

vi.mock("@/app/profile/nsfw-actions", () => ({
  toggleNsfwContent: () => mockToggleNsfwContent(),
  getNsfwContentSetting: vi.fn().mockResolvedValue(false),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/components/tooltip", () => ({
  Tooltip: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <span data-testid="tooltip" data-label={label}>
      {children}
    </span>
  ),
}));

describe("NsfwToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with NSFW off state", () => {
    render(<NsfwToggle initialEnabled={false} />);

    const button = screen.getByTestId("nsfw-toggle");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Show NSFW content");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("renders with NSFW on state", () => {
    render(<NsfwToggle initialEnabled={true} />);

    const button = screen.getByTestId("nsfw-toggle");
    expect(button).toHaveAttribute("aria-label", "Hide NSFW content");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("has red styling when enabled", () => {
    render(<NsfwToggle initialEnabled={true} />);

    const button = screen.getByTestId("nsfw-toggle");
    expect(button.className).toContain("text-red-500");
  });

  it("has gray styling when disabled", () => {
    render(<NsfwToggle initialEnabled={false} />);

    const button = screen.getByTestId("nsfw-toggle");
    expect(button.className).toContain("text-zinc-600");
  });

  it("calls toggleNsfwContent and refreshes on click", async () => {
    mockToggleNsfwContent.mockResolvedValue({ showNsfwContent: true });

    render(<NsfwToggle initialEnabled={false} />);

    fireEvent.click(screen.getByTestId("nsfw-toggle"));

    await waitFor(() => {
      expect(mockToggleNsfwContent).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("updates state after toggle", async () => {
    mockToggleNsfwContent.mockResolvedValue({ showNsfwContent: true });

    render(<NsfwToggle initialEnabled={false} />);

    fireEvent.click(screen.getByTestId("nsfw-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("nsfw-toggle")).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("shows correct tooltip label", () => {
    render(<NsfwToggle initialEnabled={false} />);

    expect(screen.getByTestId("tooltip")).toHaveAttribute("data-label", "Show NSFW content");
  });

  it("shows correct tooltip label when enabled", () => {
    render(<NsfwToggle initialEnabled={true} />);

    expect(screen.getByTestId("tooltip")).toHaveAttribute("data-label", "Hide NSFW content");
  });

  it("renders an SVG icon with circle and line (stop sign)", () => {
    render(<NsfwToggle initialEnabled={false} />);

    const svg = screen.getByTestId("nsfw-toggle").querySelector("svg");
    expect(svg).toBeTruthy();

    const circle = svg?.querySelector("circle");
    expect(circle).toBeTruthy();

    const line = svg?.querySelector("line");
    expect(line).toBeTruthy();
  });
});
