import { memo, useMemo } from "react";
import {
  View,
  Text,
  Linking,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useUserTheme } from "./themed-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LexicalTextNode {
  type: "text";
  text: string;
  format: number; // bitmask: bold=1, italic=2, underline=4, strikethrough=8, code=16
  style?: string;
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

// ---------------------------------------------------------------------------
// Format bitmask helpers
// ---------------------------------------------------------------------------

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_UNDERLINE = 4;
const FORMAT_STRIKETHROUGH = 8;
const FORMAT_CODE = 16;

function textStyleForFormat(format: number): TextStyle {
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
  return style;
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
            if (n.format === 0) {
              return (
                <Text key={i} style={parentStyle}>
                  {n.text}
                </Text>
              );
            }
            return (
              <Text key={i} style={[parentStyle, textStyleForFormat(n.format)]}>
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
      return (
        <Text style={paragraphStyle}>
          <InlineChildren nodes={n.children} />
        </Text>
      );
    }

    case "heading": {
      const n = node as LexicalHeadingNode;
      const hs = HEADING_STYLES[n.tag] ?? HEADING_STYLES.h3;
      return (
        <Text style={[{ fontSize: 15, lineHeight: 22, color: theme.textColor, fontFamily: FONT }, hs]}>
          <InlineChildren nodes={n.children} />
        </Text>
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
          <Text style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 20, color: theme.textColor }}>
            <InlineChildren nodes={n.children} />
          </Text>
        </View>
      );
    }

    case "image": {
      const n = node as LexicalImageNode;
      const w = typeof n.width === "number" ? n.width : undefined;
      const h = typeof n.height === "number" ? n.height : undefined;
      const aspectRatio = w && h ? w / h : 16 / 9;
      return (
        <View style={{ marginVertical: 8, borderRadius: 12, overflow: "hidden" }}>
          <Image
            source={{ uri: n.src }}
            style={{ width: "100%", aspectRatio, borderRadius: 12 } as any}
            contentFit="cover"
            accessibilityLabel={n.altText}
          />
          {n.caption ? (
            <Text style={{ fontSize: 13, color: theme.secondaryColor, textAlign: "center", marginTop: 4, fontFamily: FONT }}>
              {n.caption}
            </Text>
          ) : null}
        </View>
      );
    }

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
