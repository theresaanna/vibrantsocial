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
