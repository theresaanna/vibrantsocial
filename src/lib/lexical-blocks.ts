/**
 * Flatten a Lexical JSON tree into a structured `Block[]` the mobile
 * client can render block-by-block without ever walking the editor's tree
 * itself.
 *
 * The shape here is the wire format for post bodies served by
 * `/api/v1/feed`, `/api/v1/profile/:username/posts`, and
 * `/api/v1/post/:id`. Keep it in lockstep with `mobile/lib/models/block.dart`.
 */

export type Segment =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean }
  | { type: "link"; text: string; url: string }
  | { type: "mention"; text: string; username: string }
  | { type: "hashtag"; text: string; tag: string };

export interface PollBlockOption {
  id: string;
  text: string;
  votes: number;
}

export type Block =
  | { type: "paragraph"; segments: Segment[] }
  | { type: "heading"; level: 1 | 2 | 3; segments: Segment[] }
  | { type: "list"; style: "bullet" | "number"; items: Segment[][] }
  | { type: "image"; url: string; altText?: string; caption?: string }
  | { type: "youtube"; videoId: string; thumbnailUrl: string }
  | {
      type: "link_preview";
      url: string;
      title?: string;
      description?: string;
      image?: string;
    }
  | {
      type: "poll";
      question: string;
      options: PollBlockOption[];
      totalVotes: number;
      viewerVoteOptionId: string | null;
      expiresAt: string | null;
    };

interface LexicalNode {
  type: string;
  tag?: string;
  listType?: string;
  format?: number | string;
  text?: string;
  url?: string;
  username?: string;
  src?: string;
  altText?: string;
  caption?: string;
  videoID?: string;
  question?: string;
  options?: PollBlockOption[];
  expiresAt?: string | null;
  children?: LexicalNode[];
  [key: string]: unknown;
}

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;

/** Parse a post's Lexical JSON content into ordered blocks. */
export function extractBlocksFromLexicalJson(jsonString: string): Block[] {
  try {
    const parsed = JSON.parse(jsonString);
    const children: LexicalNode[] = parsed?.root?.children ?? [];
    const blocks: Block[] = [];
    for (const node of children) {
      const emitted = extractTopLevelBlock(node);
      if (emitted) blocks.push(...emitted);
    }
    return blocks;
  } catch {
    return [];
  }
}

function extractTopLevelBlock(node: LexicalNode): Block[] | null {
  switch (node.type) {
    case "paragraph": {
      // Lexical allows images / videos / YouTube embeds inline inside a
      // paragraph. For rendering we want them as their own top-level
      // blocks — split the paragraph at each media node and emit each
      // surrounding inline run as its own paragraph block.
      return splitParagraphWithMedia(node.children ?? []);
    }
    case "heading": {
      const segments = collectInlineSegments(node.children ?? []);
      if (!segmentsHaveContent(segments)) return null;
      const level = headingLevel(node.tag);
      return [{ type: "heading", level, segments }];
    }
    case "list": {
      const style: "bullet" | "number" =
        node.listType === "number" || node.tag === "ol" ? "number" : "bullet";
      const items: Segment[][] = [];
      for (const child of node.children ?? []) {
        if (child.type !== "listitem") continue;
        const segs = collectInlineSegments(child.children ?? []);
        if (segmentsHaveContent(segs)) items.push(segs);
      }
      if (items.length === 0) return null;
      return [{ type: "list", style, items }];
    }
    case "image": {
      if (typeof node.src !== "string") return null;
      return [
        {
          type: "image",
          url: node.src,
          altText: typeof node.altText === "string" ? node.altText : undefined,
          caption: typeof node.caption === "string" ? node.caption : undefined,
        },
      ];
    }
    case "youtube": {
      if (typeof node.videoID !== "string") return null;
      return [
        {
          type: "youtube",
          videoId: node.videoID,
          thumbnailUrl: `https://img.youtube.com/vi/${node.videoID}/hqdefault.jpg`,
        },
      ];
    }
    case "poll": {
      const question = typeof node.question === "string" ? node.question : "";
      const options: PollBlockOption[] = Array.isArray(node.options)
        ? node.options.map((o) => ({
            id: String(o.id ?? ""),
            text: String(o.text ?? ""),
            votes: Number(o.votes ?? 0) || 0,
          }))
        : [];
      const totalVotes = options.reduce((n, o) => n + o.votes, 0);
      return [
        {
          type: "poll",
          question,
          options,
          totalVotes,
          viewerVoteOptionId: null,
          expiresAt:
            typeof node.expiresAt === "string" ? node.expiresAt : null,
        },
      ];
    }
    default:
      // video, quote, file, sticky, page-break, date — skip for now. Their
      // underlying data isn't lost (raw Lexical is still stored on the
      // post) — the mobile renderer just doesn't surface them yet.
      return null;
  }
}

/**
 * Flatten a paragraph's children into one or more top-level blocks.
 * Media nodes (images, YouTube embeds) get hoisted to their own block;
 * inline runs between them become paragraph blocks.
 */
function splitParagraphWithMedia(children: LexicalNode[]): Block[] {
  const out: Block[] = [];
  let buffer: LexicalNode[] = [];

  function flushInline() {
    if (buffer.length === 0) return;
    const segments = collectInlineSegments(buffer);
    if (segmentsHaveContent(segments)) {
      out.push({ type: "paragraph", segments });
    }
    buffer = [];
  }

  for (const child of children) {
    if (child.type === "image" && typeof child.src === "string") {
      flushInline();
      out.push({
        type: "image",
        url: child.src,
        altText: typeof child.altText === "string" ? child.altText : undefined,
        caption: typeof child.caption === "string" ? child.caption : undefined,
      });
      continue;
    }
    if (child.type === "youtube" && typeof child.videoID === "string") {
      flushInline();
      out.push({
        type: "youtube",
        videoId: child.videoID,
        thumbnailUrl: `https://img.youtube.com/vi/${child.videoID}/hqdefault.jpg`,
      });
      continue;
    }
    buffer.push(child);
  }
  flushInline();
  return out;
}

function headingLevel(tag: string | undefined): 1 | 2 | 3 {
  if (tag === "h1") return 1;
  if (tag === "h2") return 2;
  return 3;
}

/** Walk inline/phrasing nodes into a merged segment list. */
function collectInlineSegments(nodes: LexicalNode[]): Segment[] {
  const segments: Segment[] = [];

  function pushText(text: string, bold?: boolean, italic?: boolean) {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (
      last &&
      last.type === "text" &&
      (last.bold ?? false) === (bold ?? false) &&
      (last.italic ?? false) === (italic ?? false)
    ) {
      last.text += text;
    } else {
      const seg: Segment = { type: "text", text };
      if (bold) seg.bold = true;
      if (italic) seg.italic = true;
      segments.push(seg);
    }
  }

  function walkInline(ns: LexicalNode[]) {
    for (const n of ns) {
      if (n.type === "text" && typeof n.text === "string") {
        const fmt = typeof n.format === "number" ? n.format : 0;
        pushText(
          n.text,
          (fmt & FORMAT_BOLD) !== 0,
          (fmt & FORMAT_ITALIC) !== 0,
        );
        continue;
      }
      if (n.type === "linebreak") {
        pushText("\n");
        continue;
      }
      if (n.type === "tab") {
        pushText("\t");
        continue;
      }
      if (n.type === "mention" && typeof n.username === "string") {
        segments.push({
          type: "mention",
          text: `@${n.username}`,
          username: n.username,
        });
        continue;
      }
      if (n.type === "hashtag") {
        const tag = (typeof n.text === "string" ? n.text : "").replace(
          /^#/,
          "",
        );
        if (tag) {
          segments.push({ type: "hashtag", text: `#${tag}`, tag });
        }
        continue;
      }
      if ((n.type === "link" || n.type === "autolink") && typeof n.url === "string") {
        const linkText = collectInlineText(n.children ?? []);
        if (linkText) {
          segments.push({ type: "link", text: linkText, url: n.url });
        }
        continue;
      }
      // Unknown inline node — try to descend so we don't drop its text.
      if (n.children) walkInline(n.children);
    }
  }

  walkInline(nodes);
  return segments;
}

/** Plain-text join of an inline subtree, used for link segment labels. */
function collectInlineText(nodes: LexicalNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text" && typeof n.text === "string") out += n.text;
    else if (n.type === "linebreak") out += "\n";
    else if (n.type === "tab") out += "\t";
    else if (n.type === "mention" && typeof n.username === "string") {
      out += `@${n.username}`;
    } else if (n.children) out += collectInlineText(n.children);
  }
  return out;
}

function segmentsHaveContent(segments: Segment[]): boolean {
  return segments.some((s) => s.text && s.text.trim().length > 0);
}

/**
 * Build a post-style `Block[]` from a plain-text comment body plus an
 * optional attached image. URLs in the text become link segments, with
 * YouTube URLs hoisted out as their own youtube block. The attached
 * image (if any) appends as the final block. Safe to call with an empty
 * [text] — the block list may end up empty if there's no content.
 */
const URL_RE = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi;
const YT_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?[^\s]*[?&]v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11}))/i;

export function extractBlocksFromCommentText(
  text: string,
  imageUrl: string | null = null,
): Block[] {
  const blocks: Block[] = [];
  let paragraph: Segment[] = [];

  const pushParagraph = () => {
    if (segmentsHaveContent(paragraph)) {
      blocks.push({ type: "paragraph", segments: paragraph });
    }
    paragraph = [];
  };

  const pushText = (s: string) => {
    if (!s) return;
    const last = paragraph[paragraph.length - 1];
    if (last && last.type === "text") {
      last.text += s;
    } else {
      paragraph.push({ type: "text", text: s });
    }
  };

  let cursor = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index!;
    const raw = match[0];
    if (start > cursor) pushText(text.slice(cursor, start));
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    const ytMatch = YT_RE.exec(href);
    if (ytMatch) {
      // Hoist YouTube URLs into their own block — drop the bare URL from
      // the text since the embed card replaces it visually.
      pushParagraph();
      const videoId = ytMatch[1] ?? ytMatch[2];
      blocks.push({
        type: "youtube",
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    } else {
      paragraph.push({ type: "link", text: raw, url: href });
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) pushText(text.slice(cursor));
  pushParagraph();

  if (imageUrl) {
    blocks.push({ type: "image", url: imageUrl });
  }
  return blocks;
}
