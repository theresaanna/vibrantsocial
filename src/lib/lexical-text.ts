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
