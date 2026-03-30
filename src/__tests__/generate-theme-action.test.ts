import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/anthropic", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customThemePreset: {
      count: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/premium", () => ({
  checkAndExpirePremium: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  isRateLimited: vi.fn(),
}));

import { auth } from "@/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { checkAndExpirePremium } from "@/lib/premium";
import { isRateLimited } from "@/lib/rate-limit";
import {
  generateTheme,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/app/theme/generate-theme-action";

const mockAuth = vi.mocked(auth);
const mockAnthropicCreate = vi.mocked(anthropic.messages.create);
const mockCheckPremium = vi.mocked(checkAndExpirePremium);
const mockIsRateLimited = vi.mocked(isRateLimited);

const validAiResponse = {
  name: "Neon Dreams",
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

function mockAiSuccess(data: object = validAiResponse) {
  mockAnthropicCreate.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(data) }],
  } as never);
}

describe("generateTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
    mockIsRateLimited.mockResolvedValue(false);
  });

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("rejects non-premium users", async () => {
    mockCheckPremium.mockResolvedValue(false);
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Premium subscription required");
  });

  it("rejects rate-limited users", async () => {
    mockIsRateLimited.mockResolvedValue(true);
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
  });

  it("rejects empty prompts", async () => {
    const result = await generateTheme("   ");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/enter a theme description/i);
  });

  it("truncates long prompts to 200 chars", async () => {
    mockAiSuccess();
    const longPrompt = "a".repeat(300);
    await generateTheme(longPrompt);
    const callArg = mockAnthropicCreate.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    expect(callArg.messages[0].content).toContain("a".repeat(200));
    expect(callArg.messages[0].content).not.toContain("a".repeat(201));
  });

  it("returns generated theme with valid AI response", async () => {
    mockAiSuccess();
    const result = await generateTheme("cyberpunk neon");
    expect(result.success).toBe(true);
    expect(result.name).toBe("Neon Dreams");
    expect(result.light).toBeDefined();
    expect(result.dark).toBeDefined();
    expect(result.light!.profileBgColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.dark!.profileBgColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("handles malformed JSON from AI", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Sorry, I cannot generate that." }],
    } as never);
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to generate/i);
  });

  it("handles invalid hex colors from AI", async () => {
    mockAiSuccess({
      name: "Bad",
      light: {
        profileBgColor: "not-a-color",
        profileTextColor: "#1a1a2e",
        profileLinkColor: "#6c5ce7",
        profileSecondaryColor: "#636e72",
        profileContainerColor: "#ede5f5",
      },
      dark: validAiResponse.dark,
    });
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid colors/i);
  });

  it("handles missing fields from AI", async () => {
    mockAiSuccess({
      name: "Incomplete",
      light: { profileBgColor: "#ffffff" },
      dark: validAiResponse.dark,
    });
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
  });

  it("handles API errors gracefully", async () => {
    mockAnthropicCreate.mockRejectedValue(new Error("API timeout"));
    const result = await generateTheme("cyberpunk");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to generate/i);
  });

  it("uses claude-haiku-4-5 model", async () => {
    mockAiSuccess();
    await generateTheme("cyberpunk");
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5" })
    );
  });
});

describe("saveCustomPreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockCheckPremium.mockResolvedValue(true);
  });

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await saveCustomPreset({
      name: "Test",
      prompt: "test",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects non-premium users", async () => {
    mockCheckPremium.mockResolvedValue(false);
    const result = await saveCustomPreset({
      name: "Test",
      prompt: "test",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Premium subscription required");
  });

  it("rejects empty name", async () => {
    const result = await saveCustomPreset({
      name: "   ",
      prompt: "test",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name is required/i);
  });

  it("enforces max 10 presets limit", async () => {
    vi.mocked(prisma.customThemePreset.count).mockResolvedValue(10);
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue(null);

    const result = await saveCustomPreset({
      name: "New Preset",
      prompt: "test",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum.*10/i);
  });

  it("saves a new preset successfully", async () => {
    vi.mocked(prisma.customThemePreset.count).mockResolvedValue(0);
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.customThemePreset.upsert).mockResolvedValue({
      id: "preset1",
      userId: "user1",
      name: "Neon Dreams",
      prompt: "cyberpunk neon",
      lightBgColor: validAiResponse.light.profileBgColor,
      lightTextColor: validAiResponse.light.profileTextColor,
      lightLinkColor: validAiResponse.light.profileLinkColor,
      lightSecondaryColor: validAiResponse.light.profileSecondaryColor,
      lightContainerColor: validAiResponse.light.profileContainerColor,
      darkBgColor: validAiResponse.dark.profileBgColor,
      darkTextColor: validAiResponse.dark.profileTextColor,
      darkLinkColor: validAiResponse.dark.profileLinkColor,
      darkSecondaryColor: validAiResponse.dark.profileSecondaryColor,
      darkContainerColor: validAiResponse.dark.profileContainerColor,
      createdAt: new Date(),
    } as never);

    const result = await saveCustomPreset({
      name: "Neon Dreams",
      prompt: "cyberpunk neon",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });

    expect(result.success).toBe(true);
    expect(result.preset).toBeDefined();
    expect(result.preset!.name).toBe("Neon Dreams");
    expect(result.preset!.light.profileBgColor).toBe(
      validAiResponse.light.profileBgColor
    );
  });

  it("allows upsert when name already exists", async () => {
    vi.mocked(prisma.customThemePreset.count).mockResolvedValue(10);
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue({
      id: "existing",
    } as never);
    vi.mocked(prisma.customThemePreset.upsert).mockResolvedValue({
      id: "existing",
      userId: "user1",
      name: "Neon Dreams",
      prompt: "cyberpunk neon",
      lightBgColor: validAiResponse.light.profileBgColor,
      lightTextColor: validAiResponse.light.profileTextColor,
      lightLinkColor: validAiResponse.light.profileLinkColor,
      lightSecondaryColor: validAiResponse.light.profileSecondaryColor,
      lightContainerColor: validAiResponse.light.profileContainerColor,
      darkBgColor: validAiResponse.dark.profileBgColor,
      darkTextColor: validAiResponse.dark.profileTextColor,
      darkLinkColor: validAiResponse.dark.profileLinkColor,
      darkSecondaryColor: validAiResponse.dark.profileSecondaryColor,
      darkContainerColor: validAiResponse.dark.profileContainerColor,
      createdAt: new Date(),
    } as never);

    const result = await saveCustomPreset({
      name: "Neon Dreams",
      prompt: "cyberpunk neon",
      light: validAiResponse.light,
      dark: validAiResponse.dark,
    });

    expect(result.success).toBe(true);
  });
});

describe("deleteCustomPreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
  });

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await deleteCustomPreset("preset1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects if preset not found", async () => {
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue(null);
    const result = await deleteCustomPreset("nonexistent");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("rejects if preset belongs to another user", async () => {
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue({
      id: "preset1",
      userId: "other-user",
    } as never);
    const result = await deleteCustomPreset("preset1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("deletes preset successfully", async () => {
    vi.mocked(prisma.customThemePreset.findUnique).mockResolvedValue({
      id: "preset1",
      userId: "user1",
    } as never);
    vi.mocked(prisma.customThemePreset.delete).mockResolvedValue({} as never);

    const result = await deleteCustomPreset("preset1");
    expect(result.success).toBe(true);
    expect(prisma.customThemePreset.delete).toHaveBeenCalledWith({
      where: { id: "preset1" },
    });
  });
});
