"use server";

import { auth } from "@/auth";
import { anthropic } from "@/lib/anthropic";
import { extractContentFromLexicalJson } from "@/lib/lexical-text";
import { extractTagsFromNames } from "@/lib/tags";
import type Anthropic from "@anthropic-ai/sdk";

interface AutoTagResult {
  success: boolean;
  tags: string[];
  error?: string;
}

export async function suggestTags(editorJson: string): Promise<AutoTagResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, tags: [], error: "Not authenticated" };
  }

  if (!editorJson) {
    return { success: false, tags: [], error: "No content to analyze" };
  }

  const { text, imageUrls } = extractContentFromLexicalJson(editorJson);

  if (!text && imageUrls.length === 0) {
    return { success: false, tags: [], error: "No content to analyze" };
  }

  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (text) {
    contentBlocks.push({
      type: "text",
      text: `Post text:\n${text}`,
    });
  }

  for (const url of imageUrls.slice(0, 5)) {
    contentBlocks.push({
      type: "image",
      source: {
        type: "url",
        url,
      },
    });
  }

  contentBlocks.push({
    type: "text",
    text: "Based on the above post content and any images, suggest 3-8 relevant tags for this social media post. Return ONLY a JSON array of tag strings, no other text. Tags should be lowercase, use hyphens for multi-word tags, and be concise (1-3 words each). Example: [\"photography\", \"sunset\", \"landscape\"]",
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system:
        "You are a tag suggestion assistant. You analyze social media post content and images to suggest relevant, descriptive tags. Always respond with only a JSON array of tag strings.",
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { success: false, tags: [], error: "No response from AI" };
    }

    const rawTags: string[] = JSON.parse(textBlock.text);
    if (!Array.isArray(rawTags)) {
      return { success: false, tags: [], error: "Invalid response format" };
    }

    const normalizedTags = extractTagsFromNames(rawTags);

    return { success: true, tags: normalizedTags };
  } catch (error) {
    console.error("Auto-tag error:", error);
    return { success: false, tags: [], error: "Failed to generate tags" };
  }
}
