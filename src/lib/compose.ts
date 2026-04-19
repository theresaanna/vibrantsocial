/**
 * Synthesize a Lexical JSON document from the mobile composer's
 * simplified input shape. The server-side serializers then render it
 * exactly like any web-composed post — we don't invent a parallel
 * storage format.
 */

export interface MobileComposePollOption {
  id?: string;
  text: string;
}

export interface MobileComposeImage {
  src: string;
  altText?: string;
}

export interface MobileComposeInput {
  /**
   * Plain text with `\n` separating paragraphs. URLs detected inline
   * become Lexical autolink nodes.
   */
  text: string;
  /** Optional YouTube embed (appended after the text). */
  youtubeVideoId?: string;
  /** Pre-uploaded images, appended after the text. */
  images?: MobileComposeImage[];
  /** Optional poll. */
  poll?: {
    question: string;
    options: MobileComposePollOption[];
  };
}

interface LexicalNode {
  type: string;
  version: number;
  [key: string]: unknown;
}

const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi;
const YT_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?[^\s]*[?&]v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11}))/i;

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;

/** Default text-node field bag — matches what the Lexical editor emits. */
function textNode(text: string, format: number = 0): LexicalNode {
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

interface FormattedSpan {
  text: string;
  format: number;
}

/**
 * Parse the markdown-ish markers the mobile composer emits for bold
 * and italic into Lexical format-bitmask runs. `**x**` → bold,
 * `*x*` → italic, `***x***` → bold+italic. Nested cases aren't
 * supported — the markers are treated purely as delimiter pairs.
 */
function parseFormattedSpans(input: string): FormattedSpan[] {
  const out: FormattedSpan[] = [];
  const buf: string[] = [];
  let format = 0;

  function flush() {
    if (buf.length === 0) return;
    out.push({ text: buf.join(""), format });
    buf.length = 0;
  }

  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === "*") {
      const next = input[i + 1];
      if (next === "*") {
        flush();
        format ^= FORMAT_BOLD;
        i += 2;
        continue;
      }
      flush();
      format ^= FORMAT_ITALIC;
      i += 1;
      continue;
    }
    buf.push(c);
    i += 1;
  }
  flush();
  // Merge adjacent same-format runs for a tidier tree.
  const merged: FormattedSpan[] = [];
  for (const span of out) {
    if (!span.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.format === span.format) {
      last.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function autolinkNode(url: string): LexicalNode {
  return {
    type: "autolink",
    version: 1,
    rel: "noreferrer",
    target: null,
    title: null,
    url,
    isUnlinked: false,
    direction: null,
    format: "",
    indent: 0,
    children: [textNode(url)],
  };
}

function explicitLinkNode(label: string, url: string): LexicalNode {
  // Retain any **/​* formatting inside the label so users can publish
  // styled link text.
  const labelChildren = parseFormattedSpans(label)
    .filter((s) => s.text.length > 0)
    .map((s) => textNode(s.text, s.format));
  return {
    type: "link",
    version: 1,
    rel: "noreferrer",
    target: null,
    title: null,
    url,
    direction: null,
    format: "",
    indent: 0,
    children: labelChildren.length > 0 ? labelChildren : [textNode(label)],
  };
}

/**
 * Markdown link: `[label](url)`. Disallows nested brackets in the
 * label and whitespace in the url to keep the match well-formed.
 */
const MD_LINK_RE = /\[([^\]\n]+)\]\(([^\s)]+)\)/g;

function paragraphOfLine(line: string): LexicalNode {
  const children: LexicalNode[] = [];

  /** Emit formatted text nodes for [text], preserving markdown runs. */
  function pushFormatted(text: string) {
    if (!text) return;
    for (const span of parseFormattedSpans(text)) {
      if (span.text) children.push(textNode(span.text, span.format));
    }
  }

  // Pass 1: capture explicit markdown links and bare URLs in source
  // order. Bare URLs become autolinks; `[label](url)` becomes a link
  // node wrapping the label's formatted spans.
  interface Span {
    start: number;
    end: number;
    node: LexicalNode;
  }
  const spans: Span[] = [];
  for (const m of line.matchAll(MD_LINK_RE)) {
    spans.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: explicitLinkNode(m[1], m[2]),
    });
  }
  for (const m of line.matchAll(URL_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    // Skip URLs already covered by a markdown link.
    if (spans.some((s) => start >= s.start && end <= s.end)) continue;
    const href = m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
    spans.push({ start, end, node: autolinkNode(href) });
  }
  spans.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // overlap safety
    if (span.start > cursor) pushFormatted(line.slice(cursor, span.start));
    children.push(span.node);
    cursor = span.end;
  }
  if (cursor < line.length) pushFormatted(line.slice(cursor));
  if (children.length === 0) children.push(textNode(""));
  return {
    type: "paragraph",
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    textFormat: 0,
    textStyle: "",
    children,
  };
}

/**
 * Lexical list block builder. `listType` picks the semantic style —
 * `bullet` renders as `<ul>`, `number` renders as `<ol>` with
 * per-item `value` counters.
 */
function listNode(
  listType: "bullet" | "number",
  items: string[],
): LexicalNode {
  return {
    type: "list",
    version: 1,
    listType,
    tag: listType === "number" ? "ol" : "ul",
    start: 1,
    direction: null,
    format: "",
    indent: 0,
    children: items.map((line, i) => ({
      type: "listitem",
      version: 1,
      value: i + 1,
      direction: null,
      format: "",
      indent: 0,
      children: inlineNodesFor(line),
    })),
  };
}

/**
 * Build inline children for a list-item or paragraph line — the same
 * text → markdown-link / autolink / format-span pipeline we use for
 * paragraphs, just returning the child array instead of wrapping it.
 */
function inlineNodesFor(line: string): LexicalNode[] {
  const para = paragraphOfLine(line);
  return (para.children as LexicalNode[]) ?? [];
}

const BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const NUMBER_RE = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Detect whether [chunk] is a list (every non-empty line starts with a
 * list marker of the same kind). Returns the kind + extracted item
 * texts, or null when the chunk should be rendered as a paragraph.
 */
function detectList(
  chunk: string,
): { kind: "bullet" | "number"; items: string[] } | null {
  const lines = chunk.split("\n").map((l) => l).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  if (lines.every((l) => BULLET_RE.test(l))) {
    return {
      kind: "bullet",
      items: lines.map((l) => BULLET_RE.exec(l)![1].trim()),
    };
  }
  if (lines.every((l) => NUMBER_RE.test(l))) {
    return {
      kind: "number",
      items: lines.map((l) => NUMBER_RE.exec(l)![1].trim()),
    };
  }
  return null;
}

function youtubeNode(videoId: string): LexicalNode {
  return { type: "youtube", version: 1, videoID: videoId };
}

function imageNode(src: string, altText?: string): LexicalNode {
  return {
    type: "image",
    version: 1,
    src,
    altText: altText ?? "",
    maxWidth: 1200,
    width: "inherit",
    height: "inherit",
    showCaption: false,
    captionsEnabled: true,
    caption: { editorState: { root: emptyRoot() } },
  };
}

function pollNode(
  question: string,
  options: MobileComposePollOption[],
): LexicalNode {
  return {
    type: "poll",
    version: 2,
    question,
    expiresAt: null,
    options: options.map((opt) => ({
      id: opt.id ?? randomOptionId(),
      text: opt.text,
      votes: 0,
    })),
  };
}

function emptyRoot() {
  return {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  };
}

function randomOptionId(): string {
  // Poll option ids just need to be unique within the post. Mirroring
  // the web editor's cuid-like generator isn't worth it — any random
  // token works for vote referencing.
  return `opt_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Detect a YouTube URL in the text. Used when the caller didn't
 * pre-extract `youtubeVideoId` so the composer still gets auto-embed
 * behaviour from a pasted URL.
 */
export function detectYouTubeVideoId(text: string): string | null {
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    const yt = YT_RE.exec(href);
    if (yt) return yt[1] ?? yt[2];
  }
  return null;
}

/**
 * Build the full Lexical JSON (serialized as a string) for a mobile
 * composer submission. Paragraphs are split on blank lines; URLs are
 * auto-linked; a YouTube block / images / poll append at the end.
 */
export function buildLexicalContent(input: MobileComposeInput): string {
  const blocks: LexicalNode[] = [];

  // Split on blank lines into chunks. Each chunk becomes a single
  // block: a list when every line starts with a bullet/number marker,
  // otherwise a paragraph with newlines flattened to spaces.
  const chunks = input.text
    .split(/\n\s*\n/)
    .map((c) => c.replace(/\r\n/g, "\n"))
    .filter((c) => c.trim().length > 0);

  if (chunks.length === 0) {
    blocks.push(paragraphOfLine(""));
  } else {
    for (const chunk of chunks) {
      const list = detectList(chunk);
      if (list) {
        blocks.push(listNode(list.kind, list.items));
      } else {
        blocks.push(paragraphOfLine(chunk.replace(/\n/g, " ").trim()));
      }
    }
  }

  if (input.youtubeVideoId) {
    blocks.push(youtubeNode(input.youtubeVideoId));
  }

  if (input.images) {
    for (const img of input.images) {
      blocks.push(imageNode(img.src, img.altText));
    }
  }

  if (input.poll && input.poll.options.length >= 2) {
    blocks.push(pollNode(input.poll.question, input.poll.options));
  }

  return JSON.stringify({
    root: {
      children: blocks,
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}
