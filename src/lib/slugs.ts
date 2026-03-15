import { extractTextFromLexicalJson } from "@/lib/lexical-text";

const MAX_SLUG_LENGTH = 60;

/**
 * Generate a URL slug from plain text.
 * Lowercases, strips special chars, hyphenates spaces, truncates at word boundary.
 */
export function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    const lastHyphen = slug.lastIndexOf("-");
    if (lastHyphen > 20) {
      slug = slug.slice(0, lastHyphen);
    }
    slug = slug.replace(/-+$/, "");
  }

  return slug;
}

/**
 * Generate a slug from Lexical JSON content.
 */
export function generateSlugFromContent(lexicalJson: string): string {
  const text = extractTextFromLexicalJson(lexicalJson);
  return generateSlug(text);
}

/**
 * Validate and normalize a user-provided slug.
 */
export function validateSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}
