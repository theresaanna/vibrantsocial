/**
 * Cross-platform rich text editor for compose screen.
 *
 * Architecture:
 * - Uses a standard TextInput for text entry
 * - Tracks formatting "spans" (ranges with bold/italic/color/etc.)
 * - Toolbar toggles affect the current selection or future typing
 * - On submit, builds Lexical-compatible JSON from text + spans
 *
 * This avoids WebView entirely and works on iOS, Android, and Expo Web.
 */
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TextInput,
  Text,
  type TextStyle,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
  Platform,
} from "react-native";
import { useUserTheme } from "./themed-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A formatting span applied to a range of text */
export interface FormatSpan {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  bgColor?: string;
  fontSize?: number;
}

/** Active formatting toggles (applied to next typed character) */
export interface ActiveFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
  bgColor: string | null;
  fontSize: number | null;
  blockType: "paragraph" | "h1" | "h2" | "h3" | "blockquote";
  alignment: "" | "center" | "right" | "justify";
  listType: "" | "bullet" | "number";
}

export interface RichTextEditorRef {
  /** Toggle a format on the current selection or for future typing */
  format: (command: string, value?: string) => void;
  /** Insert HTML-like content (images, embeds) — appended as media */
  insertHTML: (html: string) => void;
  /** Build and return Lexical JSON */
  getContent: () => string;
  /** Focus the editor */
  focus: () => void;
  /** Clear the editor */
  clear: () => void;
  /** Get the current active format state */
  getActiveFormat: () => ActiveFormat;
}

interface RichTextEditorProps {
  onChange?: (text: string) => void;
  onContentReady?: (lexicalJson: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}

// ---------------------------------------------------------------------------
// Default format
// ---------------------------------------------------------------------------

const DEFAULT_FORMAT: ActiveFormat = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: null,
  bgColor: null,
  fontSize: null,
  blockType: "paragraph",
  alignment: "",
  listType: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(
    {
      onChange,
      onContentReady,
      onFocus,
      onBlur,
      placeholder = "What's on your mind?",
      minHeight = 150,
      autoFocus = false,
    },
    ref,
  ) {
    const theme = useUserTheme();
    const inputRef = useRef<TextInput>(null);

    const [text, setText] = useState("");
    const [spans, setSpans] = useState<FormatSpan[]>([]);
    const [activeFormat, setActiveFormat] = useState<ActiveFormat>({ ...DEFAULT_FORMAT });
    const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

    // Track block-level formatting per line
    const [lineFormats, setLineFormats] = useState<Map<number, { blockType: string; alignment: string; listType: string }>>(new Map());

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      format: (command: string, value?: string) => {
        applyFormat(command, value);
      },
      insertHTML: (_html: string) => {
        // For images, we handle them at the compose level as separate media
        // This is a no-op for the TextInput approach
      },
      getContent: () => {
        const json = buildLexicalJson();
        onContentReady?.(json);
        return json;
      },
      focus: () => {
        inputRef.current?.focus();
      },
      clear: () => {
        setText("");
        setSpans([]);
        setActiveFormat({ ...DEFAULT_FORMAT });
        setLineFormats(new Map());
        onChange?.("");
      },
      getActiveFormat: () => activeFormat,
    }));

    // ── Apply formatting ──────────────────────────────────
    function applyFormat(command: string, value?: string) {
      const { start, end } = selection;
      const hasSelection = start !== end;

      switch (command) {
        case "bold":
        case "italic":
        case "underline":
        case "strikeThrough": {
          const key = command === "strikeThrough" ? "strikethrough" : command;
          if (hasSelection) {
            addSpan(start, end, { [key]: !getFormatAtPosition(start)[key as keyof FormatSpan] });
          }
          setActiveFormat((f) => ({ ...f, [key]: !f[key as keyof ActiveFormat] }));
          break;
        }

        case "foreColor": {
          if (hasSelection && value) {
            addSpan(start, end, { color: value });
          }
          setActiveFormat((f) => ({ ...f, color: value || null }));
          break;
        }

        case "hiliteColor": {
          if (hasSelection && value) {
            addSpan(start, end, { bgColor: value });
          }
          setActiveFormat((f) => ({ ...f, bgColor: value || null }));
          break;
        }

        case "formatBlock": {
          const blockType = value as ActiveFormat["blockType"] || "paragraph";
          setActiveFormat((f) => ({ ...f, blockType }));
          // Apply to current line
          const lineIdx = getLineIndex(start);
          setLineFormats((prev) => {
            const next = new Map(prev);
            const existing = next.get(lineIdx) || { blockType: "paragraph", alignment: "", listType: "" };
            next.set(lineIdx, { ...existing, blockType });
            return next;
          });
          break;
        }

        case "justifyLeft":
          applyAlignment("");
          break;
        case "justifyCenter":
          applyAlignment("center");
          break;
        case "justifyRight":
          applyAlignment("right");
          break;
        case "justifyFull":
          applyAlignment("justify");
          break;

        case "insertUnorderedList": {
          const lt = activeFormat.listType === "bullet" ? "" : "bullet";
          setActiveFormat((f) => ({ ...f, listType: lt as ActiveFormat["listType"] }));
          const li = getLineIndex(start);
          setLineFormats((prev) => {
            const next = new Map(prev);
            const existing = next.get(li) || { blockType: "paragraph", alignment: "", listType: "" };
            next.set(li, { ...existing, listType: lt });
            return next;
          });
          break;
        }

        case "insertOrderedList": {
          const lt = activeFormat.listType === "number" ? "" : "number";
          setActiveFormat((f) => ({ ...f, listType: lt as ActiveFormat["listType"] }));
          const li = getLineIndex(start);
          setLineFormats((prev) => {
            const next = new Map(prev);
            const existing = next.get(li) || { blockType: "paragraph", alignment: "", listType: "" };
            next.set(li, { ...existing, listType: lt });
            return next;
          });
          break;
        }

        case "createLink": {
          // For links, we'd need a more complex approach.
          // For now, just insert the URL text.
          if (value && hasSelection) {
            // The selected text becomes a link — we'll track it as a link span
            addSpan(start, end, { color: theme.linkColor, underline: true });
          }
          break;
        }
      }
    }

    function applyAlignment(alignment: string) {
      setActiveFormat((f) => ({ ...f, alignment: alignment as ActiveFormat["alignment"] }));
      const lineIdx = getLineIndex(selection.start);
      setLineFormats((prev) => {
        const next = new Map(prev);
        const existing = next.get(lineIdx) || { blockType: "paragraph", alignment: "", listType: "" };
        next.set(lineIdx, { ...existing, alignment });
        return next;
      });
    }

    function getLineIndex(pos: number): number {
      const before = text.substring(0, pos);
      return before.split("\n").length - 1;
    }

    function getFormatAtPosition(pos: number): Partial<FormatSpan> {
      const result: Partial<FormatSpan> = {};
      for (const span of spans) {
        if (span.start <= pos && span.end > pos) {
          if (span.bold) result.bold = true;
          if (span.italic) result.italic = true;
          if (span.underline) result.underline = true;
          if (span.strikethrough) result.strikethrough = true;
          if (span.color) result.color = span.color;
          if (span.bgColor) result.bgColor = span.bgColor;
        }
      }
      return result;
    }

    function addSpan(start: number, end: number, attrs: Partial<FormatSpan>) {
      setSpans((prev) => [...prev, { start, end, ...attrs }]);
    }

    // ── Text change handler ──────────────────────────────
    function handleTextChange(newText: string) {
      const oldLen = text.length;
      const newLen = newText.length;
      const diff = newLen - oldLen;

      // Adjust existing spans for the insertion/deletion
      if (diff !== 0) {
        const changePos = selection.start;
        setSpans((prev) =>
          prev
            .map((span) => {
              let { start: s, end: e } = span;
              if (diff > 0) {
                // Insertion
                if (s >= changePos) s += diff;
                else if (e > changePos) e += diff;
                if (s > changePos && e > changePos) {
                  s = Math.max(s, 0);
                }
              } else {
                // Deletion
                const delStart = changePos + diff;
                const delEnd = changePos;
                if (s >= delEnd) s += diff;
                else if (s >= delStart) s = delStart;
                if (e >= delEnd) e += diff;
                else if (e >= delStart) e = delStart;
              }
              if (e <= s) return null;
              return { ...span, start: s, end: e };
            })
            .filter(Boolean) as FormatSpan[],
        );

        // If typing new text and we have active formatting, add a span for the new chars
        if (diff > 0) {
          const { bold, italic, underline, strikethrough, color, bgColor } = activeFormat;
          if (bold || italic || underline || strikethrough || color || bgColor) {
            const newSpan: FormatSpan = {
              start: changePos,
              end: changePos + diff,
              bold: bold || undefined,
              italic: italic || undefined,
              underline: underline || undefined,
              strikethrough: strikethrough || undefined,
              color: color || undefined,
              bgColor: bgColor || undefined,
            };
            setSpans((prev) => [...prev, newSpan]);
          }
        }
      }

      setText(newText);
      onChange?.(newText);
    }

    function handleSelectionChange(
      e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
    ) {
      setSelection(e.nativeEvent.selection);
    }

    // ── Build Lexical JSON ───────────────────────────────
    function buildLexicalJson(): string {
      const lines = text.split("\n");
      const children: any[] = [];

      // Group consecutive lines with the same list type
      let currentList: { type: string; items: any[] } | null = null;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const lineStart = lines.slice(0, lineIdx).join("\n").length + (lineIdx > 0 ? 1 : 0);
        const lineEnd = lineStart + line.length;
        const lineFmt = lineFormats.get(lineIdx) || { blockType: "paragraph", alignment: "", listType: "" };

        const textChildren = buildTextNodes(line, lineStart, lineEnd);

        // Handle lists
        if (lineFmt.listType) {
          if (currentList && currentList.type === lineFmt.listType) {
            currentList.items.push(textChildren);
          } else {
            if (currentList) {
              children.push(buildListNode(currentList));
            }
            currentList = { type: lineFmt.listType, items: [textChildren] };
          }
          continue;
        }

        // Flush any pending list
        if (currentList) {
          children.push(buildListNode(currentList));
          currentList = null;
        }

        // Headings
        if (lineFmt.blockType.startsWith("h")) {
          children.push({
            children: textChildren,
            direction: "ltr",
            format: lineFmt.alignment || "",
            indent: 0,
            type: "heading",
            tag: lineFmt.blockType,
            version: 1,
          });
          continue;
        }

        // Blockquote
        if (lineFmt.blockType === "blockquote") {
          children.push({
            children: textChildren,
            direction: "ltr",
            format: "",
            indent: 0,
            type: "quote",
            version: 1,
          });
          continue;
        }

        // Regular paragraph
        children.push({
          children: textChildren,
          direction: "ltr",
          format: lineFmt.alignment || "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        });
      }

      // Flush final list
      if (currentList) {
        children.push(buildListNode(currentList));
      }

      // Ensure at least one paragraph
      if (children.length === 0) {
        children.push({
          children: [],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        });
      }

      const doc = {
        root: {
          children,
          direction: "ltr",
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      };

      return JSON.stringify(doc);
    }

    function buildListNode(list: { type: string; items: any[][] }): any {
      return {
        children: list.items.map((itemChildren, i) => ({
          children: itemChildren,
          direction: "ltr",
          format: "",
          indent: 0,
          type: "listitem",
          value: i + 1,
          version: 1,
        })),
        direction: "ltr",
        format: "",
        indent: 0,
        type: "list",
        listType: list.type,
        start: 1,
        tag: list.type === "number" ? "ol" : "ul",
        version: 1,
      };
    }

    function buildTextNodes(line: string, lineStart: number, lineEnd: number): any[] {
      if (line.length === 0) return [];

      // Build a character-level format map
      const charFormats: Array<{
        bold: boolean;
        italic: boolean;
        underline: boolean;
        strikethrough: boolean;
        color: string;
        bgColor: string;
      }> = [];

      for (let i = 0; i < line.length; i++) {
        const pos = lineStart + i;
        let bold = false;
        let italic = false;
        let underline = false;
        let strikethrough = false;
        let color = "";
        let bgColor = "";

        for (const span of spans) {
          if (span.start <= pos && span.end > pos) {
            if (span.bold) bold = true;
            if (span.italic) italic = true;
            if (span.underline) underline = true;
            if (span.strikethrough) strikethrough = true;
            if (span.color) color = span.color;
            if (span.bgColor) bgColor = span.bgColor;
          }
        }

        charFormats.push({ bold, italic, underline, strikethrough, color, bgColor });
      }

      // Group consecutive characters with the same format
      const runs: Array<{ text: string; format: typeof charFormats[0] }> = [];
      for (let i = 0; i < line.length; i++) {
        const fmt = charFormats[i];
        const last = runs[runs.length - 1];
        if (
          last &&
          last.format.bold === fmt.bold &&
          last.format.italic === fmt.italic &&
          last.format.underline === fmt.underline &&
          last.format.strikethrough === fmt.strikethrough &&
          last.format.color === fmt.color &&
          last.format.bgColor === fmt.bgColor
        ) {
          last.text += line[i];
        } else {
          runs.push({ text: line[i], format: fmt });
        }
      }

      // Check for @mentions and #hashtags within each run
      return runs.flatMap((run) => tokenizeRun(run.text, run.format));
    }

    function tokenizeRun(
      text: string,
      fmt: { bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; color: string; bgColor: string },
    ): any[] {
      const regex = /(@[a-zA-Z0-9_]+)|(#[a-zA-Z0-9_]+)/g;
      const nodes: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          nodes.push(makeTextNode(text.substring(lastIndex, match.index), fmt));
        }
        if (match[1]) {
          nodes.push({
            type: "mention",
            username: match[1].substring(1),
            userId: "",
            version: 1,
          });
        } else if (match[2]) {
          nodes.push({
            type: "hashtag",
            tagName: match[2].substring(1),
            version: 1,
          });
        }
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        nodes.push(makeTextNode(text.substring(lastIndex), fmt));
      }

      return nodes.length > 0 ? nodes : [makeTextNode(text, fmt)];
    }

    function makeTextNode(
      text: string,
      fmt: { bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; color: string; bgColor: string },
    ): any {
      let format = 0;
      if (fmt.bold) format |= 1;
      if (fmt.italic) format |= 2;
      if (fmt.underline) format |= 4;
      if (fmt.strikethrough) format |= 8;

      const styleParts: string[] = [];
      if (fmt.color) styleParts.push(`color: ${fmt.color}`);
      if (fmt.bgColor) styleParts.push(`background-color: ${fmt.bgColor}`);

      return {
        detail: 0,
        format,
        mode: "normal",
        style: styleParts.join("; "),
        text,
        type: "text",
        version: 1,
      };
    }

    // ── Compute display style for active format indicators ──
    const inputStyle = useMemo<TextStyle>(() => {
      const style: TextStyle = {
        fontSize: 17,
        lineHeight: 24,
        color: theme.textColor,
        fontFamily: "Lexend_300Light",
        minHeight,
        textAlignVertical: "top",
        padding: 0,
      };
      if (activeFormat.bold) style.fontWeight = "700";
      if (activeFormat.italic) style.fontStyle = "italic";
      if (activeFormat.blockType === "h1") {
        style.fontSize = 26;
        style.fontWeight = "800";
        style.lineHeight = 32;
      } else if (activeFormat.blockType === "h2") {
        style.fontSize = 22;
        style.fontWeight = "700";
        style.lineHeight = 28;
      } else if (activeFormat.blockType === "h3") {
        style.fontSize = 19;
        style.fontWeight = "700";
        style.lineHeight = 26;
      }
      if (activeFormat.alignment === "center") style.textAlign = "center";
      else if (activeFormat.alignment === "right") style.textAlign = "right";
      return style;
    }, [activeFormat, theme.textColor, minHeight]);

    return (
      <View style={{ minHeight }}>
        {/* Format indicator bar */}
        {(activeFormat.bold || activeFormat.italic || activeFormat.underline || activeFormat.strikethrough || activeFormat.color || activeFormat.bgColor || activeFormat.blockType !== "paragraph" || activeFormat.listType) && (
          <View style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 8,
          }}>
            {activeFormat.blockType !== "paragraph" && (
              <FormatBadge label={activeFormat.blockType.toUpperCase()} color={theme.linkColor} />
            )}
            {activeFormat.listType === "bullet" && <FormatBadge label="BULLET LIST" color={theme.linkColor} />}
            {activeFormat.listType === "number" && <FormatBadge label="NUMBERED LIST" color={theme.linkColor} />}
            {activeFormat.bold && <FormatBadge label="B" color={theme.textColor} bold />}
            {activeFormat.italic && <FormatBadge label="I" color={theme.textColor} italic />}
            {activeFormat.underline && <FormatBadge label="U" color={theme.textColor} underline />}
            {activeFormat.strikethrough && <FormatBadge label="S" color={theme.textColor} strike />}
            {activeFormat.color && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: activeFormat.color, borderWidth: 1, borderColor: theme.secondaryColor + "44" }} />
              </View>
            )}
            {activeFormat.bgColor && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: activeFormat.bgColor, borderWidth: 1, borderColor: theme.secondaryColor + "44" }} />
              </View>
            )}
          </View>
        )}

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={theme.secondaryColor}
          multiline
          autoFocus={autoFocus}
          scrollEnabled={false}
          style={inputStyle}
        />
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// Format indicator badge
// ---------------------------------------------------------------------------

function FormatBadge({
  label,
  color,
  bold,
  italic,
  underline,
  strike,
}: {
  label: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) {
  return (
    <View style={{
      backgroundColor: color + "18",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    }}>
      <Text style={{
        fontSize: 10,
        fontWeight: bold ? "700" : "600",
        fontStyle: italic ? "italic" : undefined,
        textDecorationLine: underline ? "underline" : strike ? "line-through" : undefined,
        color,
      }}>
        {label}
      </Text>
    </View>
  );
}
