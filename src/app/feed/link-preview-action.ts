"use server";

import { cached, cacheKeys } from "@/lib/cache";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

const TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1_024 * 1_024; // 1 MB
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Fetch OpenGraph / meta-tag metadata for a URL.
 * Results are cached in Redis for 7 days.
 */
export async function fetchLinkPreview(
  url: string
): Promise<LinkPreviewData | null> {
  // Validate scheme
  if (!/^https?:\/\//i.test(url)) return null;

  // Skip internal URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (baseUrl) {
    try {
      const parsed = new URL(url);
      const base = new URL(baseUrl);
      if (parsed.hostname === base.hostname) return null;
    } catch {
      return null;
    }
  }

  return cached<LinkPreviewData | null>(
    cacheKeys.linkPreview(url),
    () => fetchAndParse(url),
    CACHE_TTL_SECONDS
  );
}

async function fetchAndParse(url: string): Promise<LinkPreviewData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VibrantSocialBot/1.0; +https://vibrantsocial.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    // Read body with size limit
    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      chunks.push(value);
      if (totalBytes > MAX_BODY_BYTES) break;
    }

    reader.cancel().catch(() => {});

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const html = decoder.decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array(0))
    );

    return parseMetaTags(html, url);
  } catch {
    return null;
  }
}

function parseMetaTags(html: string, originalUrl: string): LinkPreviewData | null {
  const getMeta = (property: string): string | null => {
    // Match <meta property="..." content="..."> or <meta name="..." content="...">
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
      "i"
    );
    const match = html.match(regex);
    if (match) return decodeHtmlEntities(match[1]);

    // Also try reversed order: content before property
    const regexReversed = new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegex(property)}["']`,
      "i"
    );
    const matchReversed = html.match(regexReversed);
    return matchReversed ? decodeHtmlEntities(matchReversed[1]) : null;
  };

  const title =
    getMeta("og:title") ||
    getMeta("twitter:title") ||
    (() => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? decodeHtmlEntities(m[1].trim()) : null;
    })();

  const description =
    getMeta("og:description") ||
    getMeta("twitter:description") ||
    getMeta("description");

  let image = getMeta("og:image") || getMeta("twitter:image");
  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, originalUrl).href;
    } catch {
      image = null;
    }
  }

  const siteName = getMeta("og:site_name");

  let favicon: string | null = null;
  const faviconMatch = html.match(
    /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']*)["']/i
  );
  if (faviconMatch) {
    favicon = faviconMatch[1];
    if (!favicon.startsWith("http")) {
      try {
        favicon = new URL(favicon, originalUrl).href;
      } catch {
        favicon = null;
      }
    }
  }
  if (!favicon) {
    try {
      favicon = new URL("/favicon.ico", originalUrl).href;
    } catch {
      favicon = null;
    }
  }

  // Must have at least a title to be useful
  if (!title) return null;

  return {
    url: originalUrl,
    title,
    description: description ? description.slice(0, 300) : null,
    image,
    siteName,
    favicon,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
