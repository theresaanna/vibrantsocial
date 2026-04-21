/**
 * Round-trippable conversion between the mobile edit-profile editor's
 * markdown-ish format and the Lexical JSON the web bio renderer
 * consumes.
 *
 * Scope is deliberately narrow — only the inline marks + block types
 * the mobile toolbar can emit:
 *
 *   **bold**        → text node, format bit 1
 *   *italic*        → text node, format bit 2
 *   <u>underline</u>→ text node, format bit 8
 *   [text](url)     → link node with a text child
 *   ![alt](src)     → image node
 *   \n\n            → paragraph boundary
 *
 * No tables, lists, headings, or custom Lexical node types are parsed
 * or emitted. Anything the user types that doesn't match a pattern is
 * preserved verbatim as plain text. Heuristic parse — not a full
 * markdown engine, but the scope is fixed by the mobile toolbar.
 */

// Lexical text-node format bit flags we round-trip.
const FMT_BOLD = 1;
const FMT_ITALIC = 2;
const FMT_UNDERLINE = 8;

interface LexNode {
  type: string;
  version: number;
  // Index signature lets us build nodes inline without fighting TS
  // about optional fields that depend on `type`.
  [key: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────
// markdown → Lexical JSON
// ───────────────────────────────────────────────────────────────────

/**
 * Convert a markdown-subset string to a Lexical JSON string the web
 * bio renderer accepts.
 */
export function markdownToLexicalJson(markdown: string): string {
  const paragraphs: string[] = markdown.split(/\r?\n\s*\r?\n/);
  const paragraphNodes: LexNode[] = [];

  for (const raw of paragraphs) {
    // A paragraph that is nothing but an image becomes its own image
    // block (matches how post-body Lexical JSON puts images at the
    // top level instead of wrapping them in paragraphs).
    const imageOnly = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageOnly) {
      paragraphNodes.push(makeImageNode(imageOnly[2], imageOnly[1]));
      continue;
    }
    paragraphNodes.push(makeParagraph(parseInline(raw)));
  }

  // Empty bio sends an empty root, which Lexical's own editor would
  // also produce. Callers can decide to store null instead of this
  // string if they want (see `updateMobileProfile`).
  if (paragraphNodes.length === 0) {
    paragraphNodes.push(makeParagraph([]));
  }

  const root = {
    root: {
      type: "root",
      version: 1,
      direction: "ltr",
      format: "",
      indent: 0,
      children: paragraphNodes,
    },
  };
  return JSON.stringify(root);
}

function makeParagraph(children: LexNode[]): LexNode {
  return {
    type: "paragraph",
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children,
  };
}

function makeText(text: string, format = 0): LexNode {
  return {
    type: "text",
    version: 1,
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text,
  };
}

function makeLink(url: string, children: LexNode[]): LexNode {
  return {
    type: "link",
    version: 1,
    url,
    rel: null,
    target: null,
    title: null,
    children,
    direction: "ltr",
    format: "",
    indent: 0,
  };
}

function makeImageNode(src: string, altText: string): LexNode {
  return {
    type: "image",
    version: 1,
    src,
    altText,
    width: "inherit",
    height: "inherit",
  };
}

/**
 * Pattern-by-pattern inline scanner. Each `try` eats the longest
 * match from the current position; otherwise we consume one char as
 * plain text and continue. Nested marks (bold+italic etc.) fall out of
 * the scan naturally — the delimiters are paired and don't cross
 * paragraph boundaries.
 */
function parseInline(input: string): LexNode[] {
  const nodes: LexNode[] = [];
  let pos = 0;
  let buffer = "";
  let bufferFormat = 0;

  // Track the currently-active mark stack so we can reopen / close as
  // text runs are split across pattern matches.
  let format = 0;

  const flushBuffer = () => {
    if (!buffer) return;
    nodes.push(makeText(buffer, bufferFormat));
    buffer = "";
  };

  // Flushes whenever the caller's about to change format; keeps
  // consecutive runs with the same format glued into one text node.
  const writeChar = (ch: string) => {
    if (bufferFormat !== format) {
      flushBuffer();
      bufferFormat = format;
    }
    buffer += ch;
  };

  while (pos < input.length) {
    // Inline image: `![alt](src)` — only valid when the whole
    // paragraph isn't an image (that was handled above). Here we emit
    // it as an image node inside the paragraph, which the web
    // renderer splits into its own block via `splitParagraphWithMedia`.
    const imageMatch = matchPattern(input, pos, /^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      flushBuffer();
      nodes.push(makeImageNode(imageMatch.captures[2], imageMatch.captures[1]));
      pos = imageMatch.end;
      continue;
    }

    // Link: `[text](url)`
    const linkMatch = matchPattern(input, pos, /^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      flushBuffer();
      nodes.push(
        makeLink(linkMatch.captures[2], [
          makeText(linkMatch.captures[1], format),
        ]),
      );
      pos = linkMatch.end;
      continue;
    }

    // Bold: `**…**`. Checked before italic so `**x**` doesn't eat as
    // nested italics.
    if (input.startsWith("**", pos)) {
      flushBuffer();
      const close = input.indexOf("**", pos + 2);
      if (close === -1) {
        writeChar(input[pos]);
        pos += 1;
        continue;
      }
      format |= FMT_BOLD;
      const inner = input.slice(pos + 2, close);
      for (const innerNode of parseInlineWithFormat(inner, format)) {
        nodes.push(innerNode);
      }
      format &= ~FMT_BOLD;
      pos = close + 2;
      continue;
    }

    // Italic: `*…*` (single star). Skips `**` by virtue of the check
    // above running first.
    if (input[pos] === "*") {
      const close = input.indexOf("*", pos + 1);
      if (close === -1 || close === pos + 1) {
        writeChar(input[pos]);
        pos += 1;
        continue;
      }
      flushBuffer();
      format |= FMT_ITALIC;
      const inner = input.slice(pos + 1, close);
      for (const innerNode of parseInlineWithFormat(inner, format)) {
        nodes.push(innerNode);
      }
      format &= ~FMT_ITALIC;
      pos = close + 1;
      continue;
    }

    // Underline: `<u>…</u>`
    if (input.startsWith("<u>", pos)) {
      const close = input.indexOf("</u>", pos + 3);
      if (close === -1) {
        writeChar(input[pos]);
        pos += 1;
        continue;
      }
      flushBuffer();
      format |= FMT_UNDERLINE;
      const inner = input.slice(pos + 3, close);
      for (const innerNode of parseInlineWithFormat(inner, format)) {
        nodes.push(innerNode);
      }
      format &= ~FMT_UNDERLINE;
      pos = close + 4;
      continue;
    }

    // Literal character.
    writeChar(input[pos]);
    pos += 1;
  }
  flushBuffer();
  return nodes;
}

// Recursion helper — parse an inner span carrying an ambient format,
// but only the inner content is scanned for further marks. Avoids an
// infinite loop via an explicit format argument.
function parseInlineWithFormat(input: string, ambient: number): LexNode[] {
  // For the inner content we re-run the parser with no marks open and
  // then OR the ambient mask into every text-node format we produce.
  const nested = parseInline(input);
  for (const n of nested) {
    if (n.type === "text") {
      n.format = ((n.format as number) | ambient) >>> 0;
    } else if (n.type === "link" && Array.isArray(n.children)) {
      for (const c of n.children as LexNode[]) {
        if (c.type === "text") {
          c.format = ((c.format as number) | ambient) >>> 0;
        }
      }
    }
  }
  return nested;
}

function matchPattern(
  input: string,
  pos: number,
  pattern: RegExp,
): { end: number; captures: string[] } | null {
  const slice = input.slice(pos);
  const match = slice.match(pattern);
  if (!match) return null;
  return { end: pos + match[0].length, captures: match };
}

// ───────────────────────────────────────────────────────────────────
// Lexical JSON → markdown
// ───────────────────────────────────────────────────────────────────

interface ReadNode {
  type: string;
  children?: ReadNode[];
  text?: string;
  format?: number;
  url?: string;
  src?: string;
  altText?: string;
  [key: string]: unknown;
}

/**
 * Convert a Lexical bio back to the markdown-subset string the mobile
 * editor can hydrate. Best-effort: preserves bold / italic / underline
 * / link / image; drops heading levels, lists, and other constructs
 * into flat paragraphs (the toolbar can't round-trip those anyway).
 */
export function lexicalJsonToMarkdown(jsonString: string): string {
  let parsed: { root?: { children?: ReadNode[] } };
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // Legacy plain-text bios (pre-Lexical or mobile writes prior to
    // this feature) round-trip as themselves.
    return jsonString;
  }
  const children = parsed?.root?.children;
  if (!children) return "";

  const blocks: string[] = [];
  for (const node of children) {
    const rendered = renderBlock(node);
    if (rendered !== null) blocks.push(rendered);
  }
  return blocks.join("\n\n");
}

function renderBlock(node: ReadNode): string | null {
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return (node.children ?? []).map(renderInline).join("");
    case "image":
      if (typeof node.src !== "string") return null;
      return `![${node.altText ?? ""}](${node.src})`;
    case "list": {
      // Best-effort flattening: each list item becomes its own line.
      const items = node.children ?? [];
      const lines: string[] = [];
      for (const item of items) {
        if (item.type !== "listitem") continue;
        const text = (item.children ?? []).map(renderInline).join("");
        lines.push(text);
      }
      return lines.join("\n");
    }
    default:
      return null;
  }
}

function renderInline(node: ReadNode): string {
  if (node.type === "text" && typeof node.text === "string") {
    return applyMarks(node.text, node.format ?? 0);
  }
  if (node.type === "linebreak") return "\n";
  if (node.type === "mention" && typeof node["username"] === "string") {
    return `@${node["username"]}`;
  }
  if (node.type === "hashtag" && typeof node.text === "string") {
    return node.text.startsWith("#") ? node.text : `#${node.text}`;
  }
  if (
    (node.type === "link" || node.type === "autolink") &&
    typeof node.url === "string"
  ) {
    const inner = (node.children ?? []).map(renderInline).join("");
    return `[${inner}](${node.url})`;
  }
  if (node.type === "image" && typeof node.src === "string") {
    return `![${node.altText ?? ""}](${node.src})`;
  }
  // Unknown inline → walk children so we don't silently drop content.
  return (node.children ?? []).map(renderInline).join("");
}

function applyMarks(text: string, format: number): string {
  let out = text;
  if (format & FMT_UNDERLINE) out = `<u>${out}</u>`;
  if (format & FMT_ITALIC) out = `*${out}*`;
  if (format & FMT_BOLD) out = `**${out}**`;
  return out;
}
