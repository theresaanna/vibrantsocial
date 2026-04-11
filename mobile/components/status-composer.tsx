import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const PURPLE = "#c026d3";
const MAX_LENGTH = 100;

const BACKGROUND_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#1f2937",
  "#ec4899",
  "#f97316",
  "#06b6d4",
];

interface StatusComposerProps {
  onCreated?: () => void;
}

export function StatusComposer({ onCreated }: StatusComposerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(BACKGROUND_COLORS[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (text: string) => {
      return api.rpc("createStatus", text);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendStatuses"] });
      queryClient.invalidateQueries({ queryKey: ["userStatuses"] });
      setContent("");
      setImageUri(null);
      onCreated?.();
      if (router.canGoBack()) {
        router.back();
      }
    },
    onError: () => {
      Alert.alert("Error", "Failed to create status. Please try again.");
    },
  });

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert("Error", "Status cannot be empty.");
      return;
    }
    createMutation.mutate(trimmed);
  }, [content, createMutation]);

  const remaining = MAX_LENGTH - content.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Preview area */}
        <View style={[styles.preview, { backgroundColor: selectedColor }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
          ) : null}
          <Text style={styles.previewText}>
            {content || "What's on your mind?"}
          </Text>
        </View>

        {/* Text input */}
        <View style={styles.inputSection}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="What's on your mind?"
            placeholderTextColor="#9ca3af"
            maxLength={MAX_LENGTH}
            multiline
            style={styles.textInput}
            autoFocus
          />
          <Text
            style={[
              styles.charCount,
              remaining <= 10 && styles.charCountWarning,
            ]}
          >
            {remaining}
          </Text>
        </View>

        {/* Color picker */}
        <View style={styles.colorSection}>
          <Text style={styles.sectionLabel}>Background</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorRow}
          >
            {BACKGROUND_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorSwatchSelected,
                ]}
              />
            ))}
          </ScrollView>
        </View>

        {/* Image picker */}
        <TouchableOpacity
          onPress={handlePickImage}
          style={styles.imagePickerButton}
        >
          <Text style={styles.imagePickerText}>
            {imageUri ? "Change image" : "Add image (optional)"}
          </Text>
        </TouchableOpacity>

        {/* Post button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!content.trim() || createMutation.isPending}
          style={[
            styles.postButton,
            (!content.trim() || createMutation.isPending) &&
              styles.postButtonDisabled,
          ]}
        >
          <Text style={styles.postButtonText}>
            {createMutation.isPending ? "Posting..." : "Set Status"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  preview: {
    height: 200,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  previewText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  inputSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
    minHeight: 48,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 13,
    color: "#9ca3af",
    marginLeft: 8,
    marginTop: 4,
  },
  charCountWarning: {
    color: "#ef4444",
  },
  colorSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  colorRow: {
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  imagePickerButton: {
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderStyle: "dashed",
    marginBottom: 16,
  },
  imagePickerText: {
    color: "#6b7280",
    fontSize: 14,
  },
  postButton: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
