interface LexicalJsonNode {
  type: string;
  children?: LexicalJsonNode[];
  text?: string;
  username?: string;
  src?: string;
  altText?: string;
  caption?: string;
  [key: string]: unknown;
}

export function extractTextFromLexicalJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    const parts: string[] = [];

    function walk(nodes: LexicalJsonNode[]) {
      for (const node of nodes) {
        if (node.type === "text" && typeof node.text === "string") {
          parts.push(node.text);
        }
        if (node.type === "mention" && typeof node.username === "string") {
          parts.push(`@${node.username}`);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    }

    if (parsed?.root?.children) {
      walk(parsed.root.children);
    }
    return parts.join(" ");
  } catch {
    return "";
  }
}

export interface LexicalContent {
  text: string;
  imageUrls: string[];
}

export function extractContentFromLexicalJson(
  jsonString: string
): LexicalContent {
  try {
    const parsed = JSON.parse(jsonString);
    const textParts: string[] = [];
    const imageUrls: string[] = [];

    function walk(nodes: LexicalJsonNode[]) {
      for (const node of nodes) {
        if (node.type === "text" && typeof node.text === "string") {
          textParts.push(node.text);
        }
        if (node.type === "mention" && typeof node.username === "string") {
          textParts.push(`@${node.username}`);
        }
        if (node.type === "image" && typeof node.src === "string") {
          imageUrls.push(node.src);
          if (node.altText) textParts.push(node.altText);
          if (node.caption) textParts.push(node.caption);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    }

    if (parsed?.root?.children) {
      walk(parsed.root.children);
    }

    return {
      text: textParts.join(" ").trim(),
      imageUrls,
    };
  } catch {
    return { text: "", imageUrls: [] };
  }
}

export interface MediaItem {
  type: "image" | "video" | "youtube";
  src: string;
  altText?: string;
  width?: number | "inherit";
  height?: number | "inherit";
  fileName?: string;
  mimeType?: string;
  videoID?: string;
}

/**
 * Walk the Lexical JSON tree and extract all media nodes (images, videos, YouTube embeds).
 */
export function extractMediaFromLexicalJson(jsonString: string): MediaItem[] {
  try {
    const parsed = JSON.parse(jsonString);
    const media: MediaItem[] = [];

    function walk(nodes: LexicalJsonNode[]) {
      for (const node of nodes) {
        if (node.type === "image" && typeof node.src === "string") {
          media.push({
            type: "image",
            src: node.src,
            altText: typeof node.altText === "string" ? node.altText : undefined,
            width: node.width as number | "inherit" | undefined,
            height: node.height as number | "inherit" | undefined,
          });
        }
        if (node.type === "video" && typeof node.src === "string") {
          media.push({
            type: "video",
            src: node.src,
            fileName: typeof node.fileName === "string" ? node.fileName : undefined,
            mimeType: typeof node.mimeType === "string" ? node.mimeType : undefined,
          });
        }
        if (node.type === "youtube" && typeof node.videoID === "string") {
          media.push({
            type: "youtube",
            src: `https://www.youtube.com/watch?v=${node.videoID}`,
            videoID: node.videoID,
          });
        }
        if (node.children) {
          walk(node.children);
        }
      }
    }

    if (parsed?.root?.children) {
      walk(parsed.root.children);
    }
    return media;
  } catch {
    return [];
  }
}

export interface LinkedSegment {
  text: string;
  url?: string;
}

/**
 * Flatten a Lexical JSON tree into an ordered list of text segments where
 * link nodes carry their `url`. Paragraph and heading boundaries emit a
 * `\n\n` separator, soft line breaks emit `\n`. Good enough to render a
 * bio (or any short rich-text block) on a client that doesn't yet ship a
 * full Lexical tree renderer.
 */
export function extractLinkedSegmentsFromLexicalJson(
  jsonString: string,
): LinkedSegment[] {
  try {
    const parsed = JSON.parse(jsonString);
    const segments: LinkedSegment[] = [];
    const BLOCK_TYPES = new Set(["paragraph", "heading", "quote", "list"]);

    function push(text: string, url?: string) {
      if (!text) return;
      const last = segments[segments.length - 1];
      // Merge consecutive plain-text segments so callers don't have to.
      if (last && !last.url && !url) {
        last.text += text;
      } else {
        segments.push(url ? { text, url } : { text });
      }
    }

    function walk(nodes: LexicalJsonNode[], inheritedUrl?: string) {
      for (const node of nodes) {
        if (node.type === "text" && typeof node.text === "string") {
          push(node.text, inheritedUrl);
          continue;
        }
        if (node.type === "linebreak") {
          push("\n", inheritedUrl);
          continue;
        }
        if (node.type === "mention" && typeof node.username === "string") {
          push(`@${node.username}`, inheritedUrl);
          continue;
        }
        if ((node.type === "link" || node.type === "autolink") && typeof node.url === "string") {
          if (node.children) walk(node.children, node.url);
          continue;
        }
        if (node.children) walk(node.children, inheritedUrl);
        if (BLOCK_TYPES.has(node.type)) {
          push("\n\n");
        }
      }
    }

    if (parsed?.root?.children) walk(parsed.root.children);

    // Trim leading/trailing whitespace-only segments.
    while (segments.length && !segments[0].text.trim()) segments.shift();
    while (segments.length && !segments[segments.length - 1].text.trim()) segments.pop();
    if (segments.length) {
      segments[0].text = segments[0].text.replace(/^\s+/, "");
      const last = segments[segments.length - 1];
      last.text = last.text.replace(/\s+$/, "");
    }
    return segments;
  } catch {
    return [];
  }
}

const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch|youtu\.be\/)/i;

/**
 * Walk the Lexical JSON tree and return the URL of the first link/autolink node
 * that is NOT a YouTube URL (those already have dedicated embeds).
 */
export function extractFirstUrl(jsonString: string): string | null {
  try {
    const parsed = JSON.parse(jsonString);

    function walk(nodes: LexicalJsonNode[]): string | null {
      for (const node of nodes) {
        if (
          (node.type === "link" || node.type === "autolink") &&
          typeof node.url === "string" &&
          !YOUTUBE_RE.test(node.url)
        ) {
          return node.url;
        }
        if (node.children) {
          const found = walk(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    return parsed?.root?.children ? walk(parsed.root.children) : null;
  } catch {
    return null;
  }
}
