/**
 * Formatting toolbar for the rich text compose editor.
 * Sends formatting commands to the RichTextEditor via ref.
 */
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useUserTheme } from "./themed-view";
import type { RichTextEditorRef } from "./rich-text-editor";

// ---------------------------------------------------------------------------
// Icon Components
// ---------------------------------------------------------------------------

function BoldIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
      <Path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
    </Svg>
  );
}

function ItalicIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M19 4h-9M14 20H5M15 4L9 20" />
    </Svg>
  );
}

function UnderlineIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16" />
    </Svg>
  );
}

function StrikethroughIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M16 4H9a3 3 0 00-3 3v0a3 3 0 003 3h6a3 3 0 013 3v0a3 3 0 01-3 3H6M4 12h16" />
    </Svg>
  );
}

function ListBulletIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </Svg>
  );
}

function ListNumberIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12M8.242 12.142h12M8.242 18.293h12M5.117 5.814V3.813M3.933 5.992h2.368M5.117 5.992c-1.263 1.476-.948 4.15 1.777 4.15M5.117 12.142c-1.263-1.476-.948-4.15 1.777-4.15M3.933 18.293h2.368l-2.368-2.316 2.368-2.316" />
    </Svg>
  );
}

function HeadingIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M20 4v16M4 12h16" />
    </Svg>
  );
}

function QuoteIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4.017v10H0z" />
    </Svg>
  );
}

function LinkIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </Svg>
  );
}

function AlignLeftIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5M3.75 17.25h16.5" />
    </Svg>
  );
}

function AlignCenterIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5M3.75 17.25h16.5" />
    </Svg>
  );
}

function AlignRightIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5M3.75 17.25h16.5" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Color presets
// ---------------------------------------------------------------------------

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ff0000", "#ff4d00", "#ff9900", "#ffcc00", "#ffff00", "#99ff00",
  "#00ff00", "#00ff99", "#00ffff", "#0099ff", "#0000ff", "#9900ff",
  "#ff00ff", "#ff0099", "#cc0000", "#007acc", "#0000cc", "#7a00cc",
];

// ---------------------------------------------------------------------------
// Toolbar Component
// ---------------------------------------------------------------------------

interface ComposeToolbarProps {
  editorRef: React.RefObject<RichTextEditorRef | null>;
  onPickImage?: () => void;
  onTogglePoll?: () => void;
  onToggleNsfw?: () => void;
  onPickAudience?: () => void;
  onSchedule?: () => void;
  onInsertYouTube?: (videoID: string) => void;
  imageCount?: number;
  isNsfw?: boolean;
  hasPoll?: boolean;
  hasSchedule?: boolean;
}

export function ComposeToolbar({
  editorRef,
  onPickImage,
  onTogglePoll,
  onToggleNsfw,
  onPickAudience,
  onSchedule,
  onInsertYouTube,
  imageCount = 0,
  isNsfw = false,
  hasPoll = false,
  hasSchedule = false,
}: ComposeToolbarProps) {
  const theme = useUserTheme();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);

  const iconColor = theme.secondaryColor;
  const activeColor = theme.linkColor;

  function exec(cmd: string, val?: string) {
    editorRef.current?.format(cmd, val);
  }

  function insertLink() {
    if (linkUrl.trim()) {
      const url = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
      exec("createLink", url);
    }
    setLinkUrl("");
    setShowLinkModal(false);
  }

  function insertYoutube() {
    const match = youtubeUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (match) {
      onInsertYouTube?.(match[1]);
    }
    setYoutubeUrl("");
    setShowYoutubeModal(false);
  }

  return (
    <View>
      {/* Format toolbar row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.secondaryColor + "33",
          backgroundColor: theme.backgroundColor,
        }}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 6,
          gap: 2,
        }}
      >
        {/* Text formatting */}
        <ToolbarButton onPress={() => exec("bold")} icon={<BoldIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("italic")} icon={<ItalicIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("underline")} icon={<UnderlineIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("strikeThrough")} icon={<StrikethroughIcon color={iconColor} />} />

        <ToolbarDivider color={theme.secondaryColor} />

        {/* Headings */}
        <ToolbarButton onPress={() => setShowHeadingMenu(true)} icon={<HeadingIcon color={iconColor} />} />

        {/* Lists */}
        <ToolbarButton onPress={() => exec("insertUnorderedList")} icon={<ListBulletIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("insertOrderedList")} icon={<ListNumberIcon color={iconColor} />} />

        {/* Quote */}
        <ToolbarButton
          onPress={() => exec("formatBlock", "blockquote")}
          icon={<QuoteIcon color={iconColor} size={14} />}
        />

        <ToolbarDivider color={theme.secondaryColor} />

        {/* Text color */}
        <ToolbarButton onPress={() => setShowColorPicker(true)}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: iconColor }}>A</Text>
            <View style={{ width: 14, height: 3, backgroundColor: "#ff0000", borderRadius: 1, marginTop: -1 }} />
          </View>
        </ToolbarButton>

        {/* Background color */}
        <ToolbarButton onPress={() => setShowBgColorPicker(true)}>
          <View style={{ alignItems: "center" }}>
            <View style={{ backgroundColor: "#fef08a", borderRadius: 2, paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#854d0e" }}>A</Text>
            </View>
          </View>
        </ToolbarButton>

        <ToolbarDivider color={theme.secondaryColor} />

        {/* Alignment */}
        <ToolbarButton onPress={() => exec("justifyLeft")} icon={<AlignLeftIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("justifyCenter")} icon={<AlignCenterIcon color={iconColor} />} />
        <ToolbarButton onPress={() => exec("justifyRight")} icon={<AlignRightIcon color={iconColor} />} />

        <ToolbarDivider color={theme.secondaryColor} />

        {/* Link */}
        <ToolbarButton onPress={() => setShowLinkModal(true)} icon={<LinkIcon color={iconColor} />} />

        {/* Horizontal rule */}
        <ToolbarButton onPress={() => editorRef.current?.insertHTML("<hr/>")}>
          <View style={{ width: 16, height: 2, backgroundColor: iconColor, borderRadius: 1 }} />
        </ToolbarButton>
      </ScrollView>

      {/* Media & meta row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.secondaryColor + "22",
          backgroundColor: theme.backgroundColor,
        }}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 6,
          gap: 10,
        }}
      >
        {/* Image picker */}
        <TouchableOpacity onPress={onPickImage} disabled={imageCount >= 4}>
          <Text style={{ fontSize: 22, opacity: imageCount >= 4 ? 0.3 : 1 }}>
            {"\uD83D\uDDBC\uFE0F"}
          </Text>
        </TouchableOpacity>

        {/* YouTube */}
        <TouchableOpacity onPress={() => setShowYoutubeModal(true)}>
          <Text style={{ fontSize: 22 }}>{"\u25B6\uFE0F"}</Text>
        </TouchableOpacity>

        {/* Poll */}
        <TouchableOpacity onPress={onTogglePoll}>
          <Text style={{ fontSize: 22, opacity: hasPoll ? 1 : 0.6 }}>
            {"\uD83D\uDCCA"}
          </Text>
        </TouchableOpacity>

        {/* NSFW */}
        <TouchableOpacity
          onPress={onToggleNsfw}
          style={{
            backgroundColor: isNsfw ? "#fecaca" : theme.secondaryColor + "22",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: isNsfw ? "#ef4444" : theme.secondaryColor }}>
            NSFW
          </Text>
        </TouchableOpacity>

        {/* Audience */}
        <TouchableOpacity
          onPress={onPickAudience}
          style={{
            backgroundColor: theme.secondaryColor + "22",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>{"\uD83C\uDF0D"}</Text>
        </TouchableOpacity>

        {/* Schedule */}
        <TouchableOpacity
          onPress={onSchedule}
          style={{
            backgroundColor: hasSchedule ? "#dcfce7" : theme.secondaryColor + "22",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>{"\uD83D\uDD52"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Heading menu modal ── */}
      <Modal visible={showHeadingMenu} transparent animationType="fade" onRequestClose={() => setShowHeadingMenu(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}
          onPress={() => setShowHeadingMenu(false)}
        >
          <View style={{ backgroundColor: theme.backgroundColor, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: "600", fontSize: 16, color: theme.textColor, marginBottom: 12 }}>Block Format</Text>
            {[
              { label: "Normal", cmd: "p" },
              { label: "Heading 1", cmd: "h1" },
              { label: "Heading 2", cmd: "h2" },
              { label: "Heading 3", cmd: "h3" },
            ].map((item) => (
              <TouchableOpacity
                key={item.cmd}
                onPress={() => {
                  exec("formatBlock", item.cmd);
                  setShowHeadingMenu(false);
                }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.secondaryColor + "22" }}
              >
                <Text style={{
                  fontSize: item.cmd === "h1" ? 22 : item.cmd === "h2" ? 19 : item.cmd === "h3" ? 17 : 15,
                  fontWeight: item.cmd === "p" ? "400" : "700",
                  color: theme.textColor,
                }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Color picker modal ── */}
      <ColorPickerModal
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onSelect={(color) => {
          exec("foreColor", color);
          setShowColorPicker(false);
        }}
        title="Text Color"
        theme={theme}
      />

      {/* ── Background color picker modal ── */}
      <ColorPickerModal
        visible={showBgColorPicker}
        onClose={() => setShowBgColorPicker(false)}
        onSelect={(color) => {
          exec("hiliteColor", color);
          setShowBgColorPicker(false);
        }}
        title="Highlight Color"
        theme={theme}
      />

      {/* ── Link modal ── */}
      <Modal visible={showLinkModal} transparent animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setShowLinkModal(false)}
        >
          <View style={{ backgroundColor: theme.backgroundColor, borderRadius: 16, width: 300, padding: 20 }}>
            <Text style={{ fontWeight: "600", fontSize: 16, color: theme.textColor, marginBottom: 12 }}>Insert Link</Text>
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://example.com"
              placeholderTextColor={theme.secondaryColor}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                borderWidth: 1,
                borderColor: theme.secondaryColor + "44",
                borderRadius: 8,
                padding: 12,
                fontSize: 15,
                color: theme.textColor,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <TouchableOpacity onPress={() => setShowLinkModal(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.secondaryColor, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={insertLink}
                style={{ backgroundColor: theme.linkColor, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── YouTube modal ── */}
      <Modal visible={showYoutubeModal} transparent animationType="fade" onRequestClose={() => setShowYoutubeModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setShowYoutubeModal(false)}
        >
          <View style={{ backgroundColor: theme.backgroundColor, borderRadius: 16, width: 300, padding: 20 }}>
            <Text style={{ fontWeight: "600", fontSize: 16, color: theme.textColor, marginBottom: 12 }}>Insert YouTube Video</Text>
            <TextInput
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              placeholder="Paste YouTube URL"
              placeholderTextColor={theme.secondaryColor}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                borderWidth: 1,
                borderColor: theme.secondaryColor + "44",
                borderRadius: 8,
                padding: 12,
                fontSize: 15,
                color: theme.textColor,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <TouchableOpacity onPress={() => setShowYoutubeModal(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.secondaryColor, fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={insertYoutube}
                style={{ backgroundColor: "#ff0000", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ToolbarButton({
  onPress,
  icon,
  children,
}: {
  onPress: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.5}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={{
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
      }}
    >
      {icon || children}
    </TouchableOpacity>
  );
}

function ToolbarDivider({ color }: { color: string }) {
  return <View style={{ width: 1, height: 18, backgroundColor: color + "44", marginHorizontal: 4 }} />;
}

function ColorPickerModal({
  visible,
  onClose,
  onSelect,
  title,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  title: string;
  theme: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <View style={{
          backgroundColor: theme.backgroundColor,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
        }}>
          <Text style={{ fontWeight: "600", fontSize: 16, color: theme.textColor, marginBottom: 12 }}>{title}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {TEXT_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => onSelect(color)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: color,
                  borderWidth: 2,
                  borderColor: color === "#ffffff" ? "#d1d5db" : color,
                }}
              />
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 14, marginTop: 8 }}>
            <Text style={{ textAlign: "center", color: theme.secondaryColor, fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
