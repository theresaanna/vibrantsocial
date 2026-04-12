import { memo, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import { useUserTheme } from "./themed-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LexicalTextNode {
  type: "text";
  text: string;
  format: number; // bitmask: bold=1, italic=2, underline=4, strikethrough=8, code=16, subscript=32, superscript=64, highlight=128
  style?: string; // CSS inline styles: "color: #ff0000; font-size: 24px; ..."
}

interface LexicalLineBreakNode {
  type: "linebreak";
}

interface LexicalLinkNode {
  type: "link" | "autolink";
  url: string;
  children: LexicalNode[];
}

interface LexicalHashtagNode {
  type: "hashtag";
  tagName: string;
}

interface LexicalMentionNode {
  type: "mention";
  username: string;
  userId: string;
}

interface LexicalImageNode {
  type: "image";
  src: string;
  altText: string;
  width: number | "inherit";
  height: number | "inherit";
  caption?: string;
}

interface LexicalYouTubeNode {
  type: "youtube";
  videoID: string;
}

interface LexicalVideoNode {
  type: "video";
  src: string;
  fileName?: string;
  mimeType?: string;
  width: number | "inherit";
  height: number | "inherit";
}

interface LexicalFileNode {
  type: "file";
  src: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface LexicalDateNode {
  type: "date";
  date: string;
}

interface LexicalStickyNoteNode {
  type: "sticky-note";
  text: string;
  color: "yellow" | "pink" | "green";
}

interface LexicalListNode {
  type: "list";
  listType: "bullet" | "number" | "check";
  start?: number;
  children: LexicalNode[];
}

interface LexicalListItemNode {
  type: "listitem";
  checked?: boolean;
  children: LexicalNode[];
}

interface LexicalHeadingNode {
  type: "heading";
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  format?: string | number;
  indent?: number;
  children: LexicalNode[];
}

interface LexicalQuoteNode {
  type: "quote";
  children: LexicalNode[];
}

interface LexicalCodeNode {
  type: "code";
  language?: string;
  children: LexicalNode[];
}

interface LexicalCodeHighlightNode {
  type: "code-highlight";
  text: string;
  highlightType?: string;
}

interface LexicalTableNode {
  type: "table";
  children: LexicalNode[];
}

interface LexicalTableRowNode {
  type: "tablerow";
  children: LexicalNode[];
}

interface LexicalTableCellNode {
  type: "tablecell";
  headerState?: number;
  children: LexicalNode[];
}

interface LexicalHorizontalRuleNode {
  type: "horizontalrule";
}

interface LexicalParagraphNode {
  type: "paragraph";
  format?: string | number; // "", "left", "center", "right", "justify" or numeric
  indent?: number;
  textFormat?: number;
  textStyle?: string;
  children: LexicalNode[];
}

interface LexicalRootNode {
  type: "root";
  children: LexicalNode[];
}

interface LexicalGenericNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  [key: string]: unknown;
}

type LexicalNode =
  | LexicalTextNode
  | LexicalLineBreakNode
  | LexicalLinkNode
  | LexicalHashtagNode
  | LexicalMentionNode
  | LexicalImageNode
  | LexicalYouTubeNode
  | LexicalVideoNode
  | LexicalFileNode
  | LexicalDateNode
  | LexicalStickyNoteNode
  | LexicalListNode
  | LexicalListItemNode
  | LexicalHeadingNode
  | LexicalQuoteNode
  | LexicalCodeNode
  | LexicalCodeHighlightNode
  | LexicalTableNode
  | LexicalTableRowNode
  | LexicalTableCellNode
  | LexicalHorizontalRuleNode
  | LexicalParagraphNode
  | LexicalRootNode
  | LexicalGenericNode;

interface LexicalDoc {
  root: LexicalRootNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = "Lexend_300Light";
const BLOCK_TYPES = new Set(["image", "video", "youtube", "file", "sticky-note", "page-break", "poll"]);

// ---------------------------------------------------------------------------
// CSS style parser — converts inline CSS string to React Native TextStyle
// ---------------------------------------------------------------------------

function parseCssStyle(css: string | undefined): TextStyle {
  if (!css) return {};
  const style: TextStyle = {};
  const props = css.split(";");
  for (const prop of props) {
    const colonIdx = prop.indexOf(":");
    if (colonIdx === -1) continue;
    const key = prop.substring(0, colonIdx).trim().toLowerCase();
    const value = prop.substring(colonIdx + 1).trim();
    if (!value) continue;
    switch (key) {
      case "color":
        style.color = value;
        break;
      case "background-color":
        style.backgroundColor = value;
        break;
      case "font-size": {
        const size = parseInt(value, 10);
        if (!isNaN(size)) style.fontSize = size;
        break;
      }
      case "font-family": {
        // Map CSS font families to available RN fonts
        const family = value.split(",")[0].trim().replace(/['"]/g, "").toLowerCase();
        if (family.includes("courier") || family.includes("monospace")) {
          style.fontFamily = "monospace";
        } else if (family.includes("georgia")) {
          style.fontFamily = "Georgia";
        } else if (family.includes("times")) {
          style.fontFamily = "Times New Roman";
        } else if (family.includes("trebuchet")) {
          style.fontFamily = "Trebuchet MS";
        } else if (family.includes("verdana")) {
          style.fontFamily = "Verdana";
        } else if (family.includes("arial")) {
          style.fontFamily = "Arial";
        }
        // else leave as default (Lexend)
        break;
      }
    }
  }
  return style;
}

// ---------------------------------------------------------------------------
// Format bitmask helpers
// ---------------------------------------------------------------------------

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_UNDERLINE = 4;
const FORMAT_STRIKETHROUGH = 8;
const FORMAT_CODE = 16;
const FORMAT_SUBSCRIPT = 32;
const FORMAT_SUPERSCRIPT = 64;
const FORMAT_HIGHLIGHT = 128;

function textStyleForFormat(format: number, themeColors?: { textColor: string }): TextStyle {
  const style: TextStyle = {};
  if (format & FORMAT_BOLD) style.fontWeight = "700";
  if (format & FORMAT_ITALIC) style.fontStyle = "italic";
  if (format & FORMAT_UNDERLINE) style.textDecorationLine = "underline";
  if (format & FORMAT_STRIKETHROUGH) {
    style.textDecorationLine = style.textDecorationLine
      ? "underline line-through"
      : "line-through";
  }
  if (format & FORMAT_CODE) {
    style.fontFamily = "monospace";
    style.backgroundColor = "#f3f4f6";
    style.fontSize = 13;
  }
  if (format & FORMAT_SUBSCRIPT) {
    style.fontSize = 10;
  }
  if (format & FORMAT_SUPERSCRIPT) {
    style.fontSize = 10;
  }
  if (format & FORMAT_HIGHLIGHT) {
    style.backgroundColor = "#fef08a"; // yellow highlight
  }
  return style;
}

// ---------------------------------------------------------------------------
// Alignment helpers
// ---------------------------------------------------------------------------

type FlexAlign = "flex-start" | "center" | "flex-end" | undefined;
type TextAlign = "left" | "center" | "right" | "justify" | "auto" | undefined;

function getTextAlign(format: string | number | undefined): TextAlign {
  if (!format || format === "" || format === "left" || format === 0 || format === 1) return undefined;
  if (format === "center" || format === 2) return "center";
  if (format === "right" || format === 3) return "right";
  if (format === "justify" || format === 4) return "justify";
  return undefined;
}

function getIndentStyle(indent: number | undefined): ViewStyle {
  if (!indent || indent <= 0) return {};
  return { paddingLeft: indent * 24 };
}

// ---------------------------------------------------------------------------
// Heading sizes
// ---------------------------------------------------------------------------

const HEADING_STYLES: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontWeight: "800", marginBottom: 8, marginTop: 12, fontFamily: FONT },
  h2: { fontSize: 24, fontWeight: "700", marginBottom: 6, marginTop: 10, fontFamily: FONT },
  h3: { fontSize: 20, fontWeight: "700", marginBottom: 4, marginTop: 8, fontFamily: FONT },
  h4: { fontSize: 18, fontWeight: "600", marginBottom: 4, marginTop: 6, fontFamily: FONT },
  h5: { fontSize: 16, fontWeight: "600", marginBottom: 2, marginTop: 4, fontFamily: FONT },
  h6: { fontSize: 15, fontWeight: "600", marginBottom: 2, marginTop: 4, fontFamily: FONT },
};

// ---------------------------------------------------------------------------
// Sticky note colors
// ---------------------------------------------------------------------------

const STICKY_COLORS: Record<string, { bg: string; text: string }> = {
  yellow: { bg: "#fef9c3", text: "#854d0e" },
  pink: { bg: "#fce7f3", text: "#9d174d" },
  green: { bg: "#dcfce7", text: "#166534" },
};

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

/** Renders inline children as <Text> fragments (text, links, hashtags, etc.) */
function InlineChildren({
  nodes,
  parentStyle,
}: {
  nodes: LexicalNode[];
  parentStyle?: TextStyle;
}) {
  const router = useRouter();
  const theme = useUserTheme();

  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text": {
            const n = node as LexicalTextNode;
            const cssStyle = parseCssStyle(n.style);
            const formatStyle = n.format !== 0 ? textStyleForFormat(n.format) : {};
            const hasCustomStyle = Object.keys(cssStyle).length > 0 || n.format !== 0;
            if (!hasCustomStyle) {
              return (
                <Text key={i} style={parentStyle}>
                  {n.text}
                </Text>
              );
            }
            return (
              <Text key={i} style={[parentStyle, formatStyle, cssStyle]}>
                {n.text}
              </Text>
            );
          }

          case "linebreak":
            return <Text key={i}>{"\n"}</Text>;

          case "link":
          case "autolink": {
            const n = node as LexicalLinkNode;
            const linkStyle: TextStyle = { color: theme.linkColor, textDecorationLine: "underline" };
            return (
              <Text
                key={i}
                style={linkStyle}
                onPress={() => {
                  if (n.url) Linking.openURL(n.url);
                }}
              >
                <InlineChildren nodes={n.children} parentStyle={linkStyle} />
              </Text>
            );
          }

          case "hashtag": {
            const n = node as LexicalHashtagNode;
            return (
              <Text
                key={i}
                style={{ color: theme.linkColor, fontWeight: "600" }}
                onPress={() => router.push(`/(stack)/tag/${n.tagName}`)}
              >
                #{n.tagName}
              </Text>
            );
          }

          case "mention": {
            const n = node as LexicalMentionNode;
            return (
              <Text
                key={i}
                style={{ color: theme.linkColor, fontWeight: "600" }}
                onPress={() => router.push(`/(stack)/${n.username}`)}
              >
                @{n.username}
              </Text>
            );
          }

          case "date": {
            const n = node as LexicalDateNode;
            let display = n.date;
            try {
              display = new Date(n.date).toLocaleDateString();
            } catch {}
            return (
              <Text key={i} style={[parentStyle, { fontWeight: "600" }]}>
                {display}
              </Text>
            );
          }

          case "code-highlight": {
            const n = node as LexicalCodeHighlightNode;
            return (
              <Text key={i} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 20, color: theme.textColor }}>
                {n.text}
              </Text>
            );
          }

          default: {
            const g = node as LexicalGenericNode;
            if (g.text) {
              return (
                <Text key={i} style={parentStyle}>
                  {g.text}
                </Text>
              );
            }
            if (g.children) {
              return (
                <InlineChildren
                  key={i}
                  nodes={g.children}
                  parentStyle={parentStyle}
                />
              );
            }
            return null;
          }
        }
      })}
    </>
  );
}

/** When a paragraph contains a mix of inline (text) and block-level (image)
 *  nodes, we split them into groups so images render outside <Text>. */
function renderMixedChildren(nodes: LexicalNode[], paragraphStyle: TextStyle) {
  const groups: { type: "inline" | "block"; nodes: LexicalNode[] }[] = [];

  for (const node of nodes) {
    const isBlock = BLOCK_TYPES.has(node.type);
    const kind = isBlock ? "block" : "inline";
    const last = groups[groups.length - 1];
    if (last && last.type === kind) {
      last.nodes.push(node);
    } else {
      groups.push({ type: kind, nodes: [node] });
    }
  }

  return groups.map((group, i) => {
    if (group.type === "block") {
      return (
        <View key={i}>
          {group.nodes.map((n, j) => (
            <BlockNode key={j} node={n} />
          ))}
        </View>
      );
    }
    return (
      <Text key={i} style={paragraphStyle}>
        <InlineChildren nodes={group.nodes} />
      </Text>
    );
  });
}

/** Renders a single block-level node */
function BlockNode({ node }: { node: LexicalNode }) {
  const theme = useUserTheme();

  const paragraphStyle: TextStyle = {
    fontSize: 15,
    lineHeight: 22,
    color: theme.textColor,
    fontFamily: FONT,
    marginBottom: 6,
  };

  switch (node.type) {
    case "paragraph": {
      const n = node as LexicalParagraphNode;
      if (!n.children || n.children.length === 0) {
        return <View style={{ height: 10 }} />;
      }

      const textAlign = getTextAlign(n.format);
      const indentStyle = getIndentStyle(n.indent);
      const alignedParagraphStyle: TextStyle = {
        ...paragraphStyle,
        ...(textAlign ? { textAlign } : {}),
      };

      // Check if paragraph contains any block-level nodes (images, videos)
      const hasBlockChildren = n.children.some((c) => BLOCK_TYPES.has(c.type));
      if (hasBlockChildren) {
        return (
          <View style={[{ marginBottom: 6 }, indentStyle]}>
            {renderMixedChildren(n.children, alignedParagraphStyle)}
          </View>
        );
      }
      return (
        <View style={indentStyle}>
          <Text style={alignedParagraphStyle}>
            <InlineChildren nodes={n.children} />
          </Text>
        </View>
      );
    }

    case "heading": {
      const n = node as LexicalHeadingNode;
      const hs = HEADING_STYLES[n.tag] ?? HEADING_STYLES.h3;
      const textAlign = getTextAlign(n.format);
      const indentStyle = getIndentStyle(n.indent);
      return (
        <View style={indentStyle}>
          <Text style={[{ fontSize: 15, lineHeight: 22, color: theme.textColor, fontFamily: FONT }, hs, textAlign ? { textAlign } : {}]}>
            <InlineChildren nodes={n.children} />
          </Text>
        </View>
      );
    }

    case "list": {
      const n = node as LexicalListNode;
      return <ListBlock node={n} />;
    }

    case "quote": {
      const n = node as LexicalQuoteNode;
      return (
        <View style={{
          borderLeftWidth: 3,
          borderLeftColor: theme.secondaryColor + "66",
          paddingLeft: 12,
          marginVertical: 6,
        }}>
          <Text style={{
            fontSize: 15,
            lineHeight: 22,
            color: theme.secondaryColor,
            fontStyle: "italic",
            fontFamily: FONT,
          }}>
            <InlineChildren nodes={n.children} />
          </Text>
        </View>
      );
    }

    case "code": {
      const n = node as LexicalCodeNode;
      return (
        <View style={{
          backgroundColor: theme.secondaryColor + "1a",
          borderRadius: 8,
          padding: 12,
          marginVertical: 6,
        }}>
          {n.language ? (
            <Text style={{ fontSize: 10, color: theme.secondaryColor, marginBottom: 4, fontFamily: "monospace" }}>
              {n.language}
            </Text>
          ) : null}
          <Text style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 20, color: theme.textColor }}>
            <InlineChildren nodes={n.children} />
          </Text>
        </View>
      );
    }

    case "image": {
      const n = node as LexicalImageNode;
      return <ImageBlock node={n} />;
    }

    case "youtube": {
      const n = node as LexicalYouTubeNode;
      return <YouTubeBlock node={n} />;
    }

    case "video": {
      const n = node as LexicalVideoNode;
      return <VideoBlock node={n} />;
    }

    case "file": {
      const n = node as LexicalFileNode;
      return <FileBlock node={n} />;
    }

    case "sticky-note": {
      const n = node as LexicalStickyNoteNode;
      return <StickyNoteBlock node={n} />;
    }

    case "page-break":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.secondaryColor + "44" }} />
          <Text style={{ marginHorizontal: 8, fontSize: 11, color: theme.secondaryColor }}>
            PAGE BREAK
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.secondaryColor + "44" }} />
        </View>
      );

    case "horizontalrule":
      return <View style={{ height: 1, backgroundColor: theme.secondaryColor + "33", marginVertical: 12 }} />;

    case "table": {
      const n = node as LexicalTableNode;
      return <TableBlock node={n} />;
    }

    default: {
      const g = node as LexicalGenericNode;
      if (g.children) {
        return (
          <View>
            {g.children.map((child, i) => (
              <BlockNode key={i} node={child} />
            ))}
          </View>
        );
      }
      if (g.text) {
        return <Text style={paragraphStyle}>{g.text}</Text>;
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Image block
// ---------------------------------------------------------------------------

function ImageBlock({ node }: { node: LexicalImageNode }) {
  const theme = useUserTheme();
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth - 64;
  const w = typeof node.width === "number" && node.width > 0 ? node.width : undefined;
  const h = typeof node.height === "number" && node.height > 0 ? node.height : undefined;
  const aspectRatio = w && h ? w / h : 16 / 9;
  const imageHeight = imageWidth / aspectRatio;

  // Check if it's a GIF — expo-image handles animated GIFs natively
  const isGif = node.src?.toLowerCase().includes(".gif") || node.src?.toLowerCase().includes("giphy");

  return (
    <View style={{ marginVertical: 8, borderRadius: 12, overflow: "hidden" }}>
      <Image
        source={{ uri: node.src }}
        style={{ width: imageWidth, height: imageHeight, borderRadius: 12 }}
        contentFit="cover"
        autoplay={isGif}
        accessibilityLabel={node.altText}
      />
      {node.caption ? (
        <Text style={{ fontSize: 13, color: theme.secondaryColor, textAlign: "center", marginTop: 4, fontFamily: FONT }}>
          {node.caption}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// YouTube block — thumbnail + play button, opens in browser
// ---------------------------------------------------------------------------

function YouTubeBlock({ node }: { node: LexicalYouTubeNode }) {
  const { width: screenWidth } = useWindowDimensions();
  const videoWidth = screenWidth - 64;
  const videoHeight = videoWidth * (9 / 16);
  const thumbnailUrl = `https://img.youtube.com/vi/${node.videoID}/hqdefault.jpg`;

  const openVideo = useCallback(() => {
    Linking.openURL(`https://www.youtube.com/watch?v=${node.videoID}`);
  }, [node.videoID]);

  return (
    <TouchableOpacity
      onPress={openVideo}
      activeOpacity={0.85}
      style={{ marginVertical: 8, borderRadius: 12, overflow: "hidden" }}
    >
      <Image
        source={{ uri: thumbnailUrl }}
        style={{ width: videoWidth, height: videoHeight }}
        contentFit="cover"
      />
      {/* Play button overlay */}
      <View style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
      }}>
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "rgba(255,0,0,0.9)",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <View style={{
            width: 0,
            height: 0,
            borderLeftWidth: 22,
            borderTopWidth: 13,
            borderBottomWidth: 13,
            borderLeftColor: "#fff",
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            marginLeft: 4,
          }} />
        </View>
      </View>
      {/* YouTube label */}
      <View style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>YouTube</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Video block — native video player with expo-av
// ---------------------------------------------------------------------------

function VideoBlock({ node }: { node: LexicalVideoNode }) {
  const { width: screenWidth } = useWindowDimensions();
  const videoWidth = screenWidth - 64;
  const w = typeof node.width === "number" && node.width > 0 ? node.width : undefined;
  const h = typeof node.height === "number" && node.height > 0 ? node.height : undefined;
  const aspectRatio = w && h ? w / h : 16 / 9;
  const videoHeight = videoWidth / aspectRatio;

  return (
    <View style={{ marginVertical: 8, borderRadius: 12, overflow: "hidden" }}>
      <Video
        source={{ uri: node.src }}
        style={{ width: videoWidth, height: videoHeight }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
      />
      {node.fileName ? (
        <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, fontFamily: FONT }}>
          {node.fileName}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// File attachment block
// ---------------------------------------------------------------------------

function FileBlock({ node }: { node: LexicalFileNode }) {
  const theme = useUserTheme();

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(node.src)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.secondaryColor + "15",
        borderRadius: 10,
        padding: 12,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: theme.secondaryColor + "33",
      }}
    >
      <Text style={{ fontSize: 24, marginRight: 10 }}>{"\uD83D\uDCC4"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textColor, fontFamily: FONT }} numberOfLines={1}>
          {node.fileName}
        </Text>
        <Text style={{ fontSize: 12, color: theme.secondaryColor, fontFamily: FONT }}>
          {formatFileSize(node.fileSize)} {"\u00B7"} {node.mimeType}
        </Text>
      </View>
      <Text style={{ fontSize: 16, color: theme.linkColor }}>{"\u21E9"}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Sticky note block
// ---------------------------------------------------------------------------

function StickyNoteBlock({ node }: { node: LexicalStickyNoteNode }) {
  const colors = STICKY_COLORS[node.color] ?? STICKY_COLORS.yellow;
  return (
    <View style={{
      backgroundColor: colors.bg,
      borderRadius: 8,
      padding: 14,
      marginVertical: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.text, fontFamily: FONT }}>
        {node.text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function ListBlock({ node }: { node: LexicalListNode }) {
  const theme = useUserTheme();

  return (
    <View style={{ marginBottom: 6 }}>
      {node.children.map((item, i) => {
        if (item.type !== "listitem") return null;
        const li = item as LexicalListItemNode;

        const nestedList = li.children.find(
          (c) => c.type === "list"
        ) as LexicalListNode | undefined;
        const inlineChildren = li.children.filter((c) => c.type !== "list");

        const bullet =
          node.listType === "number"
            ? `${(node.start ?? 1) + i}. `
            : node.listType === "check"
              ? li.checked
                ? "\u2611 "
                : "\u2610 "
              : "\u2022 ";

        return (
          <View key={i}>
            <View style={{ flexDirection: "row", paddingLeft: 8, marginBottom: 2 }}>
              <Text style={{ fontSize: 15, lineHeight: 22, color: theme.secondaryColor, width: 20, fontFamily: FONT }}>
                {bullet}
              </Text>
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: theme.textColor, fontFamily: FONT }}>
                <InlineChildren nodes={inlineChildren} />
              </Text>
            </View>
            {nestedList && (
              <View style={{ paddingLeft: 16 }}>
                <ListBlock node={nestedList} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function TableBlock({ node }: { node: LexicalTableNode }) {
  const theme = useUserTheme();

  return (
    <View style={{
      borderWidth: 1,
      borderColor: theme.secondaryColor + "44",
      borderRadius: 6,
      overflow: "hidden",
      marginVertical: 8,
    }}>
      {node.children.map((row, ri) => {
        if (row.type !== "tablerow") return null;
        const tr = row as LexicalTableRowNode;
        return (
          <View key={ri} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.secondaryColor + "44" }}>
            {tr.children.map((cell, ci) => {
              if (cell.type !== "tablecell") return null;
              const tc = cell as LexicalTableCellNode;
              const isHeader = (tc.headerState ?? 0) > 0;
              return (
                <View
                  key={ci}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRightWidth: 1,
                    borderRightColor: theme.secondaryColor + "44",
                    backgroundColor: isHeader ? theme.secondaryColor + "1a" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      color: theme.textColor,
                      fontWeight: isHeader ? "700" : "400",
                      fontFamily: FONT,
                    }}
                  >
                    {tc.children.map((child, k) => {
                      if (child.type === "paragraph") {
                        const p = child as LexicalParagraphNode;
                        return (
                          <InlineChildren key={k} nodes={p.children} />
                        );
                      }
                      return null;
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LexicalRendererProps {
  /** Lexical JSON as a string or already-parsed object */
  content: string | LexicalDoc;
}

export const LexicalRenderer = memo(function LexicalRenderer({
  content,
}: LexicalRendererProps) {
  const theme = useUserTheme();

  const doc = useMemo<LexicalDoc | null>(() => {
    if (typeof content === "object" && content !== null) {
      return content as LexicalDoc;
    }
    try {
      const parsed = JSON.parse(content as string);
      if (parsed?.root?.type === "root") return parsed as LexicalDoc;
      return null;
    } catch {
      return null;
    }
  }, [content]);

  if (!doc) {
    // Fallback: render raw string as plain text
    return (
      <Text style={{ fontSize: 15, lineHeight: 22, color: theme.textColor, fontFamily: FONT }}>
        {typeof content === "string" ? content : ""}
      </Text>
    );
  }

  return (
    <View>
      {doc.root.children.map((node, i) => (
        <BlockNode key={i} node={node} />
      ))}
    </View>
  );
});
