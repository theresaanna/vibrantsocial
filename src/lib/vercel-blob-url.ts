/**
 * Verify a URL string points at our Vercel Blob CDN.
 *
 * Substring checks on `"blob.vercel-storage.com"` are unsound —
 * attacker-controlled URLs such as
 *   `https://evil.com/?x=blob.vercel-storage.com`
 *   `https://blob.vercel-storage.com.evil.com/...`
 * both contain the substring but don't originate from our bucket.
 *
 * This helper parses the URL, requires the https scheme, and matches
 * the hostname exactly (`blob.vercel-storage.com`) or as a suffix of
 * the per-store subdomain (`<store>.public.blob.vercel-storage.com`).
 * Use it anywhere we accept a URL as "trusted blob" or decide whether
 * to call `del()` on it during cleanup.
 */
export function isVercelBlobUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    return (
      host === "blob.vercel-storage.com" ||
      host.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
