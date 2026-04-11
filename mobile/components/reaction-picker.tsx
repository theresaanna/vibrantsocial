import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import EmojiPicker from "rn-emoji-keyboard";

const COMMON_REACTIONS = [
  { emoji: "\u{1F44D}", name: "thumbs up" },
  { emoji: "\u2764\uFE0F", name: "heart" },
  { emoji: "\u{1F602}", name: "face with tears of joy" },
  { emoji: "\u{1F62E}", name: "face with open mouth" },
  { emoji: "\u{1F622}", name: "crying face" },
  { emoji: "\u{1F621}", name: "angry face" },
];

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Position hint: top offset for the popover */
  anchorY?: number;
}

/**
 * Emoji reaction picker that shows a horizontal row of common reactions
 * plus a "+" button that opens the full rn-emoji-keyboard.
 * Floats above content as a popover with a white bg, rounded corners, and shadow.
 */
export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  const [showFullPicker, setShowFullPicker] = useState(false);

  if (!visible && !showFullPicker) return null;

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <>
      {visible && (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
          <Pressable style={styles.overlay} onPress={onClose}>
            <View style={styles.pickerContainer}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={styles.quickRow}>
                  {COMMON_REACTIONS.map((r) => (
                    <TouchableOpacity
                      key={r.emoji}
                      onPress={() => handleSelect(r.emoji)}
                      activeOpacity={0.6}
                      style={styles.quickButton}
                    >
                      <Text style={styles.quickEmoji}>{r.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      setShowFullPicker(true);
                    }}
                    activeOpacity={0.6}
                    style={styles.quickButton}
                  >
                    <Text style={styles.plusIcon}>+</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      <EmojiPicker
        onEmojiSelected={(emojiObject) => {
          handleSelect(emojiObject.emoji);
          setShowFullPicker(false);
        }}
        open={showFullPicker}
        onClose={() => setShowFullPicker(false)}
        enableSearchBar
        categoryPosition="top"
        theme={{
          backdrop: "rgba(0,0,0,0.3)",
          knob: "#c026d3",
          container: "#fff",
          header: "#1f2937",
          category: {
            icon: "#9ca3af",
            iconActive: "#c026d3",
            container: "#fff",
            containerActive: "#faf5ff",
          },
          search: {
            text: "#1f2937",
            placeholder: "#9ca3af",
            icon: "#9ca3af",
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  quickButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
  },
  quickEmoji: {
    fontSize: 26,
  },
  plusIcon: {
    fontSize: 22,
    color: "#9ca3af",
    fontWeight: "600",
  },
});
