import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestTags } from "@/app/feed/auto-tag-action";

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

vi.mock("@/lib/lexical-text", () => ({
  extractContentFromLexicalJson: vi.fn(),
}));

vi.mock("@/lib/tags", () => ({
  extractTagsFromNames: vi.fn((names: string[]) =>
    names.map((n) =>
      n
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 50)
    ).filter(Boolean)
  ),
}));

import { auth } from "@/auth";
import { anthropic } from "@/lib/anthropic";
import { extractContentFromLexicalJson } from "@/lib/lexical-text";

const mockAuth = vi.mocked(auth);
const mockAnthropicCreate = vi.mocked(anthropic.messages.create);
const mockExtractContent = vi.mocked(extractContentFromLexicalJson);

describe("suggestTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "Not authenticated",
    });
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("returns error if editorJson is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);

    const result = await suggestTags("");
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "No content to analyze",
    });
  });

  it("returns error if no text or images extracted", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({ text: "", imageUrls: [] });

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "No content to analyze",
    });
  });

  it("calls Claude API with text content", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "A photo of a beautiful sunset at the beach",
      imageUrls: [],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '["sunset", "beach", "photography"]',
        },
      ],
    } as never);

    const result = await suggestTags('{"root":{}}');

    expect(result.success).toBe(true);
    expect(result.tags).toEqual(["sunset", "beach", "photography"]);

    const call = mockAnthropicCreate.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5");
    const message = call.messages[0];
    expect(message.role).toBe("user");
    const content = message.content as Array<{ type: string; text?: string }>;
    expect(content[0]).toEqual({
      type: "text",
      text: "Post text:\nA photo of a beautiful sunset at the beach",
    });
  });

  it("calls Claude API with image URLs", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "",
      imageUrls: ["https://example.com/photo.jpg"],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: '["nature"]' }],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result.success).toBe(true);

    const call = mockAnthropicCreate.mock.calls[0][0];
    const message = call.messages[0];
    const content = message.content as Array<{
      type: string;
      source?: { type: string; url: string };
    }>;
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/photo.jpg" },
    });
  });

  it("calls Claude API with both text and images", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "My vacation photos",
      imageUrls: ["https://example.com/photo.jpg"],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: '["vacation", "travel"]' }],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result.success).toBe(true);
    expect(result.tags).toEqual(["vacation", "travel"]);

    const call = mockAnthropicCreate.mock.calls[0][0];
    const message = call.messages[0];
    const content = message.content as Array<{ type: string }>;
    // text block, image block, instruction text block
    expect(content).toHaveLength(3);
    expect(content[0].type).toBe("text");
    expect(content[1].type).toBe("image");
    expect(content[2].type).toBe("text");
  });

  it("limits images to 5 maximum", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Many photos",
      imageUrls: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
        "https://example.com/6.jpg",
        "https://example.com/7.jpg",
      ],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: '["gallery"]' }],
    } as never);

    await suggestTags('{"root":{}}');

    const call = mockAnthropicCreate.mock.calls[0][0];
    const message = call.messages[0];
    const content = message.content as Array<{ type: string }>;
    const imageBlocks = content.filter((b) => b.type === "image");
    expect(imageBlocks).toHaveLength(5);
  });

  it("handles Claude API error gracefully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Some content",
      imageUrls: [],
    });
    mockAnthropicCreate.mockRejectedValue(new Error("API error"));

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "Failed to generate tags",
    });
  });

  it("handles invalid JSON response from Claude", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Some content",
      imageUrls: [],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "not valid json" }],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "Failed to generate tags",
    });
  });

  it("handles non-array JSON response from Claude", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Some content",
      imageUrls: [],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"tags": ["a"]}' }],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "Invalid response format",
    });
  });

  it("handles response with no text block", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Some content",
      imageUrls: [],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result).toEqual({
      success: false,
      tags: [],
      error: "No response from AI",
    });
  });

  it("normalizes returned tags through extractTagsFromNames", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } } as never);
    mockExtractContent.mockReturnValue({
      text: "Some content",
      imageUrls: [],
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '["Beach Life", "SUNSET", "Nature & Wildlife"]',
        },
      ],
    } as never);

    const result = await suggestTags('{"root":{}}');
    expect(result.success).toBe(true);
    // Mock strips non-alphanumeric except hyphens (spaces stripped too)
    expect(result.tags).toEqual(["beachlife", "sunset", "naturewildlife"]);
  });
});
