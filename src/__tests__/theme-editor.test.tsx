import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeEditor } from "@/components/theme-editor";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";
import type { CustomPresetData } from "@/lib/profile-themes";

// Mock ThemePreview to keep tests focused
vi.mock("@/components/theme-preview", () => ({
  ThemePreview: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="theme-preview">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock server actions
vi.mock("@/app/theme/generate-theme-action", () => ({
  generateTheme: vi.fn(),
  saveCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
}));

import {
  generateTheme,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/theme/generate-theme-action";

const mockGenerateTheme = vi.mocked(generateTheme);
const mockSavePreset = vi.mocked(saveCustomPreset);
const mockDeletePreset = vi.mocked(deleteCustomPreset);

const defaultProps = {
  initialColors: {},
  username: "testuser",
  displayName: "Test User",
  bio: null,
  avatarSrc: null,
};

const sampleCustomPreset: CustomPresetData = {
  id: "preset1",
  name: "Neon Dreams",
  prompt: "cyberpunk neon",
  light: {
    profileBgColor: "#f8f0ff",
    profileTextColor: "#1a1a2e",
    profileLinkColor: "#6c5ce7",
    profileSecondaryColor: "#636e72",
    profileContainerColor: "#ede5f5",
  },
  dark: {
    profileBgColor: "#1a1a2e",
    profileTextColor: "#e8e0f0",
    profileLinkColor: "#a29bfe",
    profileSecondaryColor: "#b2bec3",
    profileContainerColor: "#2d2d4a",
  },
};

async function expandSection() {
  await userEvent.click(
    screen.getByRole("button", { name: /profile theme/i })
  );
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
    expect(textInput.value).toBe(
      PROFILE_THEME_PRESETS.default.profileTextColor
    );
  });
});

describe("ThemeEditor — AI generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AI prompt input for premium users", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();
    expect(screen.getByTestId("ai-prompt-input")).toBeInTheDocument();
    expect(screen.getByTestId("ai-generate-button")).toBeInTheDocument();
  });

  it("disables AI prompt for non-premium users", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={false} />);
    await expandSection();
    expect(screen.getByTestId("ai-prompt-input")).toBeDisabled();
    expect(screen.getByTestId("ai-generate-button")).toBeDisabled();
  });

  it("disables generate button when prompt is empty", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();
    const generateButton = screen.getByTestId("ai-generate-button");
    expect(generateButton).toBeDisabled();
  });

  it("shows error from failed generation", async () => {
    mockGenerateTheme.mockResolvedValue({
      success: false,
      error: "API error occurred",
    });

    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    const input = screen.getByTestId("ai-prompt-input");
    await userEvent.type(input, "cyberpunk");

    const button = screen.getByTestId("ai-generate-button");
    await userEvent.click(button);

    expect(await screen.findByTestId("ai-generation-error")).toHaveTextContent(
      "API error occurred"
    );
  });

  it("shows save preset form after successful generation", async () => {
    mockGenerateTheme.mockResolvedValue({
      success: true,
      name: "Neon Dreams",
      light: sampleCustomPreset.light,
      dark: sampleCustomPreset.dark,
    });

    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.type(screen.getByTestId("ai-prompt-input"), "cyberpunk");
    await userEvent.click(screen.getByTestId("ai-generate-button"));

    expect(await screen.findByTestId("save-preset-form")).toBeInTheDocument();
    const nameInput = screen.getByTestId(
      "preset-name-input"
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Neon Dreams");
  });

  it("updates color pickers after successful generation", async () => {
    mockGenerateTheme.mockResolvedValue({
      success: true,
      name: "Neon Dreams",
      light: sampleCustomPreset.light,
      dark: sampleCustomPreset.dark,
    });

    const { container } = render(
      <ThemeEditor {...defaultProps} isPremium={true} />
    );
    await expandSection();

    await userEvent.type(screen.getByTestId("ai-prompt-input"), "cyberpunk");
    await userEvent.click(screen.getByTestId("ai-generate-button"));

    // Wait for state update
    await screen.findByTestId("save-preset-form");

    const bgInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(bgInput.value).toBe(sampleCustomPreset.light.profileBgColor);
  });
});

describe("ThemeEditor — custom presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders custom preset pills", async () => {
    render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        customPresets={[sampleCustomPreset]}
      />
    );
    await expandSection();
    expect(
      screen.getByTestId("custom-preset-Neon Dreams")
    ).toBeInTheDocument();
  });

  it("selects a custom preset and updates colors", async () => {
    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        customPresets={[sampleCustomPreset]}
      />
    );
    await expandSection();

    const presetButton = screen.getByTestId("custom-preset-Neon Dreams");
    await userEvent.click(presetButton);

    const bgInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(bgInput.value).toBe(sampleCustomPreset.light.profileBgColor);
    expect(presetButton).toHaveAttribute("aria-pressed", "true");
  });

  it("shows delete button on hover", async () => {
    render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        customPresets={[sampleCustomPreset]}
      />
    );
    await expandSection();

    expect(
      screen.getByTestId("delete-preset-Neon Dreams")
    ).toBeInTheDocument();
  });

  it("calls delete action when delete button clicked", async () => {
    mockDeletePreset.mockResolvedValue({ success: true });

    render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        customPresets={[sampleCustomPreset]}
      />
    );
    await expandSection();

    const deleteButton = screen.getByTestId("delete-preset-Neon Dreams");
    await userEvent.click(deleteButton);

    expect(mockDeletePreset).toHaveBeenCalledWith("preset1");
  });
});
