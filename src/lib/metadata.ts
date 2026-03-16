import type { Metadata } from "next";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";

export const SITE_NAME = "VibrantSocial";
export const SITE_DESCRIPTION =
  "Social media for adults. No algorithms, no AI nonsense — just self expression.";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://vibrantsocial.app"
  );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "\u2026";
}

/**
 * Strip JSON and markdown from a string so meta descriptions
 * never expose machine-looking content.
 */
export function sanitizeForMeta(text: string): string {
  if (!text) return text;

  let result = text;

  // If it looks like Lexical JSON, extract plain text from it
  if (result.trimStart().startsWith("{")) {
    const extracted = extractTextFromLexicalJson(result);
    if (extracted) result = extracted;
  }

  result = result
    // Markdown images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Markdown links: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Headings: ## heading → heading
    .replace(/^#{1,6}\s+/gm, "")
    // Bold/italic: **text**, __text__, *text*, _text_
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, "$2")
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, "$1")
    // Code fences: ```...``` (must come before inline code)
    .replace(/```[\s\S]*?```/g, "")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "$1")
    // Blockquotes: > text → text
    .replace(/^>\s+/gm, "")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Unordered list markers: - item, * item
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Ordered list markers: 1. item
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // HTML tags
    .replace(/<[^>]+>/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  return result;
}

export function buildMetadata({
  title,
  description,
  path,
  images,
  noIndex,
}: {
  title: string;
  description: string;
  path?: string;
  images?: { url: string; alt?: string }[];
  noIndex?: boolean;
}): Metadata {
  const baseUrl = getBaseUrl();
  const url = path ? `${baseUrl}${path}` : undefined;
  const cleanDescription = sanitizeForMeta(description);

  return {
    title,
    description: cleanDescription,
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description: cleanDescription,
      siteName: SITE_NAME,
      type: "website",
      ...(url && { url }),
      ...(images && { images }),
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      title,
      description: cleanDescription,
      ...(images && { images: images.map((i) => i.url) }),
    },
    ...(url && { alternates: { canonical: url } }),
  };
}
