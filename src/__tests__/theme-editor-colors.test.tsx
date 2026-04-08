import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeEditor } from "@/components/theme-editor";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";

// Mock server actions
vi.mock("@/app/theme/generate-theme-action", () => ({
  generateTheme: vi.fn(),
  saveCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
}));

import {
  generateTheme,
  saveCustomPreset,
} from "@/app/theme/generate-theme-action";

const mockGenerateTheme = vi.mocked(generateTheme);
const mockSavePreset = vi.mocked(saveCustomPreset);

// Mock FramedAvatar
vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({
    src,
    initial,
    frameId,
  }: {
    src: string | null;
    initial: string;
    frameId?: string | null;
    size: number;
  }) => (
    <div
      data-testid="framed-avatar"
      data-frame-id={frameId ?? ""}
      data-src={src ?? ""}
    >
      {initial}
    </div>
  ),
}));

// Mock StyledName
vi.mock("@/components/styled-name", () => ({
  StyledName: ({
    fontId,
    children,
  }: {
    fontId: string | null | undefined;
    children: React.ReactNode;
  }) => (
    <span data-testid="styled-name" data-font-id={fontId ?? ""}>
      {children}
    </span>
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
  await userEvent.click(
    screen.getByRole("button", { name: /^theme$/i })
  );
}

describe("ThemeEditor — preview uses FramedAvatar and StyledName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders FramedAvatar in the preview", async () => {
    render(<ThemeEditor {...defaultProps} frameId="spring-1" />);
    await expandSection();

    const avatar = screen.getByTestId("framed-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-frame-id", "spring-1");
  });

  it("renders FramedAvatar without frame when frameId is null", async () => {
    render(<ThemeEditor {...defaultProps} frameId={null} />);
    await expandSection();

    const avatar = screen.getByTestId("framed-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("data-frame-id", "");
  });

  it("passes avatarSrc to FramedAvatar", async () => {
    render(
      <ThemeEditor
        {...defaultProps}
        avatarSrc="https://example.com/avatar.jpg"
        frameId="neon-1"
      />
    );
    await expandSection();

    const avatar = screen.getByTestId("framed-avatar");
    expect(avatar).toHaveAttribute(
      "data-src",
      "https://example.com/avatar.jpg"
    );
  });

  it("renders StyledName with fontId in the preview", async () => {
    render(<ThemeEditor {...defaultProps} fontId="sofadi-one" />);
    await expandSection();

    const styledName = screen.getByTestId("styled-name");
    expect(styledName).toBeInTheDocument();
    expect(styledName).toHaveAttribute("data-font-id", "sofadi-one");
    expect(styledName).toHaveTextContent("Test User");
  });

  it("renders StyledName with empty fontId when no font set", async () => {
    render(<ThemeEditor {...defaultProps} fontId={null} />);
    await expandSection();

    const styledName = screen.getByTestId("styled-name");
    expect(styledName).toHaveAttribute("data-font-id", "");
  });

  it("shows display name initial in FramedAvatar", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const avatar = screen.getByTestId("framed-avatar");
    expect(avatar).toHaveTextContent("T");
  });
});

describe("ThemeEditor — individual color pickers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders five color picker inputs", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs).toHaveLength(5);
  });

  it("renders labels for each color field", async () => {
    render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
  });

  it("color pickers reflect the current color values", async () => {
    const customColors = {
      profileBgColor: "#112233",
      profileTextColor: "#445566",
      profileLinkColor: "#778899",
      profileSecondaryColor: "#aabbcc",
      profileContainerColor: "#ddeeff",
    };
    const { container } = render(
      <ThemeEditor {...defaultProps} initialColors={customColors} />
    );
    await expandSection();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    expect(colorInputs[0].value).toBe("#112233");
    expect(colorInputs[1].value).toBe("#445566");
    expect(colorInputs[2].value).toBe("#778899");
    expect(colorInputs[3].value).toBe("#aabbcc");
    expect(colorInputs[4].value).toBe("#ddeeff");
  });

  it("changing a color picker updates the corresponding hidden input", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    const bgColorPicker = colorInputs[0];

    fireEvent.input(bgColorPicker, { target: { value: "#ff0000" } });

    const hiddenInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe("#ff0000");
  });

  it("changing a color picker updates the preview background", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;

    fireEvent.input(colorInputs[0], { target: { value: "#ff0000" } });

    const hiddenInput = container.querySelector(
      'input[name="profileBgColor"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe("#ff0000");
  });

  it("changing individual color clears the active preset", async () => {
    const preset = {
      id: "p1",
      name: "Test Preset",
      prompt: "",
      light: {
        profileBgColor: "#111111",
        profileTextColor: "#222222",
        profileLinkColor: "#333333",
        profileSecondaryColor: "#444444",
        profileContainerColor: "#555555",
      },
      dark: {
        profileBgColor: "#111111",
        profileTextColor: "#222222",
        profileLinkColor: "#333333",
        profileSecondaryColor: "#444444",
        profileContainerColor: "#555555",
      },
    };

    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        customPresets={[preset]}
      />
    );
    await expandSection();

    // Select the preset
    const presetButton = screen.getByTestId("custom-preset-Test Preset");
    await userEvent.click(presetButton);
    expect(presetButton).toHaveAttribute("aria-pressed", "true");

    // Change one color
    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(colorInputs[0], { target: { value: "#ff0000" } });

    // Preset should no longer be active
    expect(presetButton).toHaveAttribute("aria-pressed", "false");
  });

  it("changing text color updates hidden input for profileTextColor", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;

    // Second color picker = text
    fireEvent.input(colorInputs[1], { target: { value: "#00ff00" } });

    const hiddenInput = container.querySelector(
      'input[name="profileTextColor"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe("#00ff00");
  });

  it("each color picker can be changed independently", async () => {
    const { container } = render(<ThemeEditor {...defaultProps} />);
    await expandSection();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;

    fireEvent.input(colorInputs[0], { target: { value: "#aa0000" } });
    fireEvent.input(colorInputs[2], { target: { value: "#00aa00" } });
    fireEvent.input(colorInputs[4], { target: { value: "#0000aa" } });

    expect(
      (container.querySelector('input[name="profileBgColor"]') as HTMLInputElement).value
    ).toBe("#aa0000");
    expect(
      (container.querySelector('input[name="profileLinkColor"]') as HTMLInputElement).value
    ).toBe("#00aa00");
    expect(
      (container.querySelector('input[name="profileContainerColor"]') as HTMLInputElement).value
    ).toBe("#0000aa");

    // Text and secondary should still be defaults
    expect(
      (container.querySelector('input[name="profileTextColor"]') as HTMLInputElement).value
    ).toBe(PROFILE_THEME_PRESETS.default.profileTextColor);
    expect(
      (container.querySelector('input[name="profileSecondaryColor"]') as HTMLInputElement).value
    ).toBe(PROFILE_THEME_PRESETS.default.profileSecondaryColor);
  });

  it("notifies parent via onColorsChange when a color is changed", async () => {
    const onColorsChange = vi.fn();
    const { container } = render(
      <ThemeEditor {...defaultProps} onColorsChange={onColorsChange} />
    );
    await expandSection();

    // Clear initial call from mount
    onColorsChange.mockClear();

    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(colorInputs[0], { target: { value: "#ff0000" } });

    expect(onColorsChange).toHaveBeenCalledWith(
      expect.objectContaining({ profileBgColor: "#ff0000" })
    );
  });
});

describe("ThemeEditor — editing colors in a generated theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("editing a color updates the generated theme so save captures the edit", async () => {
    const generatedLight = {
      profileBgColor: "#aaaaaa",
      profileTextColor: "#bbbbbb",
      profileLinkColor: "#cccccc",
      profileSecondaryColor: "#dddddd",
      profileContainerColor: "#eeeeee",
    };

    mockGenerateTheme.mockResolvedValue({
      success: true,
      name: "Generated",
      light: generatedLight,
      dark: generatedLight,
    });

    mockSavePreset.mockResolvedValue({
      success: true,
      preset: {
        id: "saved-1",
        name: "Generated",
        prompt: "",
        light: { ...generatedLight, profileBgColor: "#ff0000" },
        dark: { ...generatedLight, profileBgColor: "#ff0000" },
      },
    });

    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        currentBgImage="/bg.jpg"
      />
    );
    await expandSection();

    // Generate a theme
    const generateButton = screen.getByTestId("ai-generate-button");
    await userEvent.click(generateButton);

    // Wait for generated theme save form
    const saveForm = await screen.findByTestId("save-preset-form");
    expect(saveForm).toBeInTheDocument();

    // Edit background color
    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(colorInputs[0], { target: { value: "#ff0000" } });

    // Save the preset — the edited color should be in the call
    const saveButton = screen.getByTestId("save-preset-button");
    await userEvent.click(saveButton);

    expect(mockSavePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        light: expect.objectContaining({ profileBgColor: "#ff0000" }),
        dark: expect.objectContaining({ profileBgColor: "#ff0000" }),
      })
    );
  });

  it("generated theme save form persists after editing individual colors", async () => {
    const generatedLight = {
      profileBgColor: "#aaaaaa",
      profileTextColor: "#bbbbbb",
      profileLinkColor: "#cccccc",
      profileSecondaryColor: "#dddddd",
      profileContainerColor: "#eeeeee",
    };

    mockGenerateTheme.mockResolvedValue({
      success: true,
      name: "Sunset",
      light: generatedLight,
      dark: generatedLight,
    });

    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        currentBgImage="/bg.jpg"
      />
    );
    await expandSection();

    await userEvent.click(screen.getByTestId("ai-generate-button"));
    await screen.findByTestId("save-preset-form");

    // Edit a color
    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(colorInputs[1], { target: { value: "#123456" } });

    // Save form should still be visible
    expect(screen.getByTestId("save-preset-form")).toBeInTheDocument();
    // Preset name should still be populated
    const nameInput = screen.getByTestId(
      "preset-name-input"
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Sunset");
  });

  it("non-edited colors in generated theme are preserved when saving", async () => {
    const generatedLight = {
      profileBgColor: "#aaaaaa",
      profileTextColor: "#bbbbbb",
      profileLinkColor: "#cccccc",
      profileSecondaryColor: "#dddddd",
      profileContainerColor: "#eeeeee",
    };

    mockGenerateTheme.mockResolvedValue({
      success: true,
      name: "Ocean",
      light: generatedLight,
      dark: generatedLight,
    });

    mockSavePreset.mockResolvedValue({
      success: true,
      preset: {
        id: "saved-2",
        name: "Ocean",
        prompt: "",
        light: { ...generatedLight, profileLinkColor: "#0000ff" },
        dark: { ...generatedLight, profileLinkColor: "#0000ff" },
      },
    });

    const { container } = render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        currentBgImage="/bg.jpg"
      />
    );
    await expandSection();

    await userEvent.click(screen.getByTestId("ai-generate-button"));
    await screen.findByTestId("save-preset-form");

    // Only change the link color (index 2)
    const colorInputs = container.querySelectorAll(
      'input[type="color"]'
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(colorInputs[2], { target: { value: "#0000ff" } });

    await userEvent.click(screen.getByTestId("save-preset-button"));

    expect(mockSavePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        light: expect.objectContaining({
          profileBgColor: "#aaaaaa",
          profileTextColor: "#bbbbbb",
          profileLinkColor: "#0000ff",
          profileSecondaryColor: "#dddddd",
          profileContainerColor: "#eeeeee",
        }),
      })
    );
  });
});

describe("ThemeEditor — generate button text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Generate Theme from Background Upload' text", async () => {
    render(
      <ThemeEditor
        {...defaultProps}
        isPremium={true}
        currentBgImage="/bg.jpg"
      />
    );
    await expandSection();

    expect(screen.getByTestId("ai-generate-button")).toHaveTextContent(
      "Generate Theme from Background Upload"
    );
  });
});
