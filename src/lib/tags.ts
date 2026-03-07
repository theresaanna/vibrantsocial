/**
 * Normalize a raw tag string: lowercase, trim, strip leading #,
 * remove non-alphanumeric characters (except hyphens), max 50 chars.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
}

/**
 * Normalize an array of tag names, removing duplicates and invalid entries.
 */
export function extractTagsFromNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const normalized = normalizeTag(name);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Check whether a tag string is valid after normalization.
 */
export function isValidTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  return normalized.length > 0;
}
