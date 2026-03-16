import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeEditor } from "@/components/theme-editor";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";

// Mock ThemePreview to keep tests focused
vi.mock("@/components/theme-preview", () => ({
  ThemePreview: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="theme-preview">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const defaultProps = {
  initialColors: {},
  username: "testuser",
  displayName: "Test User",
  bio: null,
  avatarSrc: null,
};

async function expandSection() {
  await userEvent.click(screen.getByRole("button", { name: /profile theme/i }));
}

describe("ThemeEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts collapsed and expands on click", async () => {
    render(<ThemeEditor {...defaultProps} />);
    const toggle = screen.getByRole("button", { name: /profile theme/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("renders all preset buttons", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    for (const name of Object.keys(PROFILE_THEME_PRESETS)) {
      expect(
        screen.getByRole("button", { name: new RegExp(name, "i") })
      ).toBeInTheDocument();
    }
  });

  it("renders 5 color picker inputs", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    expect(screen.getByLabelText("Background")).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toBeInTheDocument();
    expect(screen.getByLabelText("Links")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary Text")).toBeInTheDocument();
    expect(screen.getByLabelText("Container")).toBeInTheDocument();
  });

  it("selecting a preset updates hidden form inputs", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    const oceanButton = screen.getByRole("button", { name: /ocean/i });
    await userEvent.click(oceanButton);

    const oceanPreset = PROFILE_THEME_PRESETS.ocean;
    const hiddenInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe(oceanPreset.profileBgColor);
  });

  it("marks selected preset as pressed", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    const oceanButton = screen.getByRole("button", { name: /ocean/i });

    expect(oceanButton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(oceanButton);
    expect(oceanButton).toHaveAttribute("aria-pressed", "true");
  });

  it("clears active preset when no preset is initially selected", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    for (const name of Object.keys(PROFILE_THEME_PRESETS)) {
      const button = screen.getByRole("button", {
        name: new RegExp(name, "i"),
      });
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("renders hidden inputs for all 5 color fields", () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    expect(
      container.querySelector('input[name="profileBgColor"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="profileTextColor"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="profileLinkColor"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="profileSecondaryColor"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="profileContainerColor"]')
    ).toBeInTheDocument();
  });

  it("shows preview modal when preview button is clicked", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    expect(screen.queryByTestId("theme-preview")).not.toBeInTheDocument();

    const previewBtn = screen.getByRole("button", { name: /preview/i });
    await userEvent.click(previewBtn);

    expect(screen.getByTestId("theme-preview")).toBeInTheDocument();
  });

  it("closes preview modal when close is clicked", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    await userEvent.click(screen.getByRole("button", { name: /preview/i }));
    expect(screen.getByTestId("theme-preview")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("theme-preview")).not.toBeInTheDocument();
  });

  it("initializes from provided colors", () => {
    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        initialColors={{ profileBgColor: "#123456" }}
      />
    );
    const hiddenInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe("#123456");
  });

  it("falls back to default preset for missing initial colors", () => {
    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        initialColors={{ profileBgColor: "#123456" }}
      />
    );
    const textInput = container.querySelector(
      'input[name="profileTextColor"]'
    ) as HTMLInputElement;
    expect(textInput.value).toBe(PROFILE_THEME_PRESETS.default.profileTextColor);
  });
});
