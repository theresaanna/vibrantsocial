import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeEditor } from "@/components/theme-editor";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";
import type { CustomPresetData } from "@/lib/profile-themes";

// Mock server actions
vi.mock("@/app/theme/generate-theme-action", () => ({
  saveCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
}));

import {
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/theme/generate-theme-action";

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
    screen.getByRole("button", { name: /^theme$/i })
  );
}

describe("ThemeEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts collapsed and expands on click", async () => {
    render(<ThemeEditor {...defaultProps} />);
    const toggle = screen.getByRole("button", { name: /^theme$/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("does not render built-in preset buttons", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();
    // Built-in presets like "ocean" should not appear
    expect(
      screen.queryByRole("button", { name: /^ocean$/i })
    ).not.toBeInTheDocument();
  });

  it("applies external colors when provided", () => {
    const externalColors = {
      profileBgColor: "#111111",
      profileTextColor: "#222222",
      profileLinkColor: "#333333",
      profileSecondaryColor: "#444444",
      profileContainerColor: "#555555",
    };
    const { container } = render(
      <ThemeEditor {...defaultProps} externalColors={externalColors} />
    );
    const bgInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(bgInput.value).toBe("#111111");
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

describe("ThemeEditor — save current theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows save current theme button for premium users", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();
    expect(
      screen.getByRole("button", { name: /save current theme as preset/i })
    ).toBeInTheDocument();
  });

  it("does not show save current theme button for non-premium users", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={false} />);
    await expandSection();
    expect(
      screen.queryByRole("button", { name: /save current theme as preset/i })
    ).not.toBeInTheDocument();
  });

  it("shows save form when button is clicked", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );

    expect(screen.getByTestId("save-current-theme-form")).toBeInTheDocument();
    expect(screen.getByTestId("save-current-name-input")).toBeInTheDocument();
  });

  it("hides save form when cancel is clicked", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );
    expect(screen.getByTestId("save-current-theme-form")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByTestId("save-current-theme-form")).not.toBeInTheDocument();
  });

  it("save button is disabled when name is empty", async () => {
    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );

    expect(screen.getByTestId("save-current-button")).toBeDisabled();
  });

  it("calls saveCustomPreset with current colors and name", async () => {
    mockSavePreset.mockResolvedValue({
      success: true,
      preset: {
        id: "new-preset",
        name: "My Theme",
        prompt: "",
        light: PROFILE_THEME_PRESETS.default,
        dark: PROFILE_THEME_PRESETS.midnight,
      },
    });

    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );

    await userEvent.type(screen.getByTestId("save-current-name-input"), "My Theme");
    await userEvent.click(screen.getByTestId("save-current-button"));

    expect(mockSavePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Theme",
        imageUrl: "",
        light: expect.objectContaining({ profileBgColor: expect.any(String) }),
        dark: expect.objectContaining({ profileBgColor: expect.any(String) }),
      })
    );
  });

  it("adds saved preset as a custom preset pill", async () => {
    mockSavePreset.mockResolvedValue({
      success: true,
      preset: {
        id: "new-preset",
        name: "My Theme",
        prompt: "",
        light: PROFILE_THEME_PRESETS.default,
        dark: PROFILE_THEME_PRESETS.midnight,
      },
    });

    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );

    await userEvent.type(screen.getByTestId("save-current-name-input"), "My Theme");
    await userEvent.click(screen.getByTestId("save-current-button"));

    expect(
      await screen.findByTestId("custom-preset-My Theme")
    ).toBeInTheDocument();
    // Form should be hidden after successful save
    expect(screen.queryByTestId("save-current-theme-form")).not.toBeInTheDocument();
  });

  it("shows error when save fails", async () => {
    mockSavePreset.mockResolvedValue({
      success: false,
      error: "Maximum of 10 custom presets reached. Delete one first.",
    });

    render(<ThemeEditor {...defaultProps} isPremium={true} />);
    await expandSection();

    await userEvent.click(
      screen.getByRole("button", { name: /save current theme as preset/i })
    );

    await userEvent.type(screen.getByTestId("save-current-name-input"), "My Theme");
    await userEvent.click(screen.getByTestId("save-current-button"));

    expect(
      await screen.findByText(/maximum of 10 custom presets/i)
    ).toBeInTheDocument();
  });
});
