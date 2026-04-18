/**
 * AI tag suggestions for the mobile composer.
 *
 * `POST /api/v1/compose/suggest-tags`
 *   { text: string, imageUrls?: string[] }
 *
 * Returns `{ tags: string[] }` — normalized tag names the user can
 * one-tap into their post. Mirrors the web `suggestTags` server action
 * but takes plain text rather than Lexical JSON so the mobile composer
 * doesn't need to assemble a tree just to ask for suggestions.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { extractTagsFromNames } from "@/lib/tags";

const MAX_IMAGES = 5;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const rateLimited = await checkRateLimit(
    apiLimiter,
    `mobile-suggest-tags:${viewer.userId}`,
  );
  if (rateLimited) return rateLimited;

  let body: { text?: string; imageUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim();
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u): u is string => typeof u === "string").slice(0, MAX_IMAGES)
    : [];

  if (!text && imageUrls.length === 0) {
    return corsJson(
      req,
      { error: "No content to analyze." },
      { status: 400 },
    );
  }

  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  if (text) {
    contentBlocks.push({ type: "text", text: `Post text:\n${text}` });
  }
  for (const url of imageUrls) {
    contentBlocks.push({
      type: "image",
      source: { type: "url", url },
    });
  }
  contentBlocks.push({
    type: "text",
    text:
      "Based on the above post content and any images, suggest 3-8 relevant tags for this social media post. " +
      'Return ONLY a JSON array of tag strings, no other text. Tags should be lowercase, use hyphens for multi-word tags, and be concise (1-3 words each). Example: ["photography", "sunset", "landscape"]',
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system:
        "You are a tag suggestion assistant. You analyze social media post content and images to suggest relevant, descriptive tags. Always respond with only a JSON array of tag strings.",
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return corsJson(req, { error: "No response from AI" }, { status: 502 });
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    let rawTags: unknown;
    try {
      rawTags = JSON.parse(cleaned);
    } catch {
      return corsJson(
        req,
        { error: "Model returned non-JSON tags" },
        { status: 502 },
      );
    }
    if (!Array.isArray(rawTags)) {
      return corsJson(
        req,
        { error: "Model did not return a JSON array" },
        { status: 502 },
      );
    }
    const stringTags = rawTags.filter(
      (t): t is string => typeof t === "string",
    );
    const normalized = extractTagsFromNames(stringTags);
    return corsJson(req, { tags: normalized });
  } catch (err) {
    console.error("[suggest-tags]", err);
    return corsJson(
      req,
      { error: "Failed to generate tags" },
      { status: 502 },
    );
  }
}
