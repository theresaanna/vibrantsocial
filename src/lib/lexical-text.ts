interface LexicalJsonNode {
  type: string;
  children?: LexicalJsonNode[];
  text?: string;
  username?: string;
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
