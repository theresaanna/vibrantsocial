/**
 * ColorPicker — Mobile-friendly color picker component.
 * Shows a grid of preset colors, the current selection as a filled circle,
 * and a hex input for custom colors.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { isValidHexColor } from "@/lib/user-theme";

// ── Preset color grids ──────────────────────────────────────────────

const PRESET_COLORS = [
  // Neutrals
  "#ffffff", "#f8fafc", "#f4f4f5", "#e4e4e7", "#d4d4d8",
  "#a1a1aa", "#71717a", "#52525b", "#27272a", "#18181b",
  "#111827", "#0f172a", "#000000",
  // Reds / Pinks
  "#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6",
  "#ec4899", "#e11d48", "#be123c", "#9f1239", "#881337",
  // Oranges / Ambers
  "#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24",
  "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f",
  // Greens
  "#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80",
  "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d",
  // Blues
  "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a",
  // Purples
  "#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc",
  "#a855f7", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95",
  // Teals / Cyans
  "#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf",
  "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a",
  // Special dark theme colors
  "#0c1929", "#0f1f0f", "#1c0f0a", "#0f0720", "#1a0e0a",
  "#172a45", "#1a3a1a", "#2d1810", "#1a0e35", "#2d1a12",
];

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [hexInput, setHexInput] = useState(value);

  const handleSelectColor = useCallback(
    (color: string) => {
      onChange(color);
      setHexInput(color);
    },
    [onChange],
  );

  const handleHexSubmit = useCallback(() => {
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (isValidHexColor(normalized)) {
      onChange(normalized.toLowerCase());
      setHexInput(normalized.toLowerCase());
    } else {
      // Revert to current value
      setHexInput(value);
    }
  }, [hexInput, onChange, value]);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setHexInput(value);
          setShowModal(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: "#f9fafb",
          borderRadius: 10,
        }}
      >
        {/* Color swatch */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: value,
            borderWidth: 2,
            borderColor: "#e5e7eb",
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
            {label}
          </Text>
          <Text style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>
            {value}
          </Text>
        </View>
        <Text style={{ color: "#d1d5db", fontSize: 18 }}>{">"}</Text>
      </TouchableOpacity>

      {/* Color picker modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600" }}>{label}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ fontSize: 16, color: "#c026d3", fontWeight: "600" }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Current color preview */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: value,
                borderWidth: 2,
                borderColor: "#e5e7eb",
              }}
            />
            <View style={{ flex: 1 }}>
              <TextInput
                value={hexInput}
                onChangeText={setHexInput}
                onBlur={handleHexSubmit}
                onSubmitEditing={handleHexSubmit}
                placeholder="#000000"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
                style={{
                  fontSize: 18,
                  fontFamily: "monospace",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              />
            </View>
          </View>

          {/* Color grid */}
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {PRESET_COLORS.map((color) => {
                const isSelected = color.toLowerCase() === value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={color}
                    onPress={() => handleSelectColor(color)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: color,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? "#c026d3" : "#e5e7eb",
                    }}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
