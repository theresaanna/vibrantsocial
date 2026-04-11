import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";
import { PollCreator, type PollCreatorData } from "@/components/poll-creator";

type AudienceType = "public" | "friends" | "close_friends";

export default function ComposeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  // New feature state
  const [isNsfw, setIsNsfw] = useState(false);
  const [audience, setAudience] = useState<AudienceType>("public");
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pollData, setPollData] = useState<PollCreatorData | null>(null);

  const createPost = useMutation({
    mutationFn: async () => {
      // Upload images first
      const mediaUrls: string[] = [];
      if (images.length > 0) {
        setUploading(true);
        for (const img of images) {
          const result = await api.upload({
            uri: img.uri,
            name: img.fileName ?? `photo-${Date.now()}.jpg`,
            type: img.mimeType ?? "image/jpeg",
          });
          mediaUrls.push(result.url);
        }
        setUploading(false);
      }

      // Create Lexical-compatible JSON for text content
      const editorState = {
        root: {
          children: [
            {
              children: [{ detail: 0, format: 0, mode: "normal", style: "", text: content, type: "text", version: 1 }],
              direction: "ltr",
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      };

      // Build poll options if poll is active
      let pollOptions: { question: string; options: string[]; durationHours: number } | undefined;
      if (pollData) {
        const validOptions = pollData.options.filter((o) => o.trim());
        if (validOptions.length >= 2 && pollData.question.trim()) {
          pollOptions = {
            question: pollData.question.trim(),
            options: validOptions,
            durationHours: pollData.durationHours,
          };
        }
      }

      return api.rpc("createPost", {
        content: JSON.stringify(editorState),
        mediaUrls,
        isNsfw,
        isCloseFriendsOnly: audience === "close_friends",
        isLoggedInOnly: audience === "friends",
        scheduledFor: scheduledFor?.toISOString() ?? undefined,
        poll: pollOptions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      setContent("");
      setImages([]);
      setIsNsfw(false);
      setAudience("public");
      setScheduledFor(null);
      setPollData(null);
      Toast.show({
        type: "success",
        text1: scheduledFor ? "Post scheduled!" : "Post created!",
      });
      router.navigate("/(tabs)");
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to create post" });
    },
  });

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 4 - images.length,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 4));
    }
  }

  function togglePoll() {
    if (pollData) {
      setPollData(null);
    } else {
      setPollData({ question: "", options: ["", ""], durationHours: 24 });
    }
  }

  const isSubmitting = createPost.isPending || uploading;
  const hasContent = content.trim() || images.length > 0 || (pollData && pollData.question.trim() && pollData.options.filter((o) => o.trim()).length >= 2);

  const audienceLabel =
    audience === "public"
      ? "Public"
      : audience === "friends"
        ? "Friends Only"
        : "Close Friends";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#6b7280", fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => createPost.mutate()}
            disabled={isSubmitting || !hasContent}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 8,
              opacity: isSubmitting || !hasContent ? 0.5 : 1,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {scheduledFor ? "Schedule" : "Post"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }}>
          {/* Audience badge */}
          {audience !== "public" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  backgroundColor: "#fae8ff",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#c026d3", fontSize: 12, fontWeight: "600" }}>
                  {audienceLabel}
                </Text>
              </View>
            </View>
          )}

          {/* Schedule indicator */}
          {scheduledFor && (
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
                backgroundColor: "#f0fdf4",
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: "#16a34a" }}>
                Scheduled: {scheduledFor.toLocaleDateString()} at{" "}
                {scheduledFor.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <TouchableOpacity
                onPress={() => setScheduledFor(null)}
                style={{ marginLeft: "auto", padding: 4 }}
              >
                <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>
                  X
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* NSFW indicator */}
          {isNsfw && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
                backgroundColor: "#fef2f2",
                padding: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: "#ef4444", fontWeight: "600" }}>
                NSFW
              </Text>
            </View>
          )}

          <TextInput
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            style={{
              fontSize: 18,
              minHeight: 120,
              textAlignVertical: "top",
            }}
          />

          {/* Image previews */}
          {images.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {images.map((img, i) => (
                <View key={i} style={{ position: "relative" }}>
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 100, height: 100, borderRadius: 8 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      backgroundColor: "#000",
                      borderRadius: 10,
                      width: 20,
                      height: 20,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Poll creator */}
          {pollData && (
            <PollCreator
              data={pollData}
              onChange={setPollData}
              onRemove={() => setPollData(null)}
            />
          )}
        </ScrollView>

        {/* Toolbar */}
        <View
          style={{
            flexDirection: "row",
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            gap: 16,
            alignItems: "center",
          }}
        >
          {/* Image picker */}
          <TouchableOpacity onPress={pickImage} disabled={images.length >= 4}>
            <Text style={{ fontSize: 24, opacity: images.length >= 4 ? 0.3 : 1 }}>
              {"\uD83D\uDDBC\uFE0F"}
            </Text>
          </TouchableOpacity>

          {/* Poll toggle */}
          <TouchableOpacity onPress={togglePoll}>
            <Text style={{ fontSize: 24, opacity: pollData ? 1 : 0.6 }}>
              {"\uD83D\uDCCA"}
            </Text>
          </TouchableOpacity>

          {/* NSFW toggle */}
          <TouchableOpacity
            onPress={() => setIsNsfw((v) => !v)}
            style={{
              backgroundColor: isNsfw ? "#fecaca" : "#f3f4f6",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: isNsfw ? "#ef4444" : "#9ca3af",
              }}
            >
              NSFW
            </Text>
          </TouchableOpacity>

          {/* Audience picker */}
          <TouchableOpacity
            onPress={() => setShowAudienceMenu(true)}
            style={{
              backgroundColor: audience === "public" ? "#f3f4f6" : "#fae8ff",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: audience === "public" ? "#9ca3af" : "#c026d3",
              }}
            >
              {audience === "public"
                ? "\uD83C\uDF0D"
                : audience === "friends"
                  ? "\uD83D\uDC65"
                  : "\u2B50"}
            </Text>
          </TouchableOpacity>

          {/* Schedule button */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: scheduledFor ? "#dcfce7" : "#f3f4f6",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: scheduledFor ? "#16a34a" : "#9ca3af",
              }}
            >
              {"\uD83D\uDD52"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date picker */}
        {showDatePicker && (
          <DateTimePicker
            value={scheduledFor ?? new Date(Date.now() + 3600000)}
            mode="date"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === "set" && date) {
                const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                setScheduledFor(newDate);
                setShowTimePicker(true);
              }
            }}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={scheduledFor ?? new Date(Date.now() + 3600000)}
            mode="time"
            onChange={(event, date) => {
              setShowTimePicker(false);
              if (event.type === "set" && date) {
                const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                newDate.setHours(date.getHours(), date.getMinutes());
                setScheduledFor(newDate);
              }
            }}
          />
        )}

        {/* Audience picker modal */}
        <Modal
          visible={showAudienceMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAudienceMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={() => setShowAudienceMenu(false)}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                width: 280,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 16, color: "#1f2937" }}>
                  Who can see this post?
                </Text>
              </View>

              {(
                [
                  { key: "public", label: "Public", icon: "\uD83C\uDF0D", description: "Everyone" },
                  { key: "friends", label: "Friends Only", icon: "\uD83D\uDC65", description: "Your friends" },
                  { key: "close_friends", label: "Close Friends", icon: "\u2B50", description: "Your close friends" },
                ] as const
              ).map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    setAudience(option.key);
                    setShowAudienceMenu(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: "#f3f4f6",
                    backgroundColor:
                      audience === option.key ? "#faf5ff" : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>
                    {option.icon}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#1f2937" }}>
                      {option.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                      {option.description}
                    </Text>
                  </View>
                  {audience === option.key && (
                    <Text style={{ color: "#c026d3", fontSize: 16, fontWeight: "700" }}>
                      {"\u2713"}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => setShowAudienceMenu(false)}
                style={{ paddingVertical: 14, paddingHorizontal: 16 }}
              >
                <Text style={{ fontSize: 15, color: "#9ca3af", textAlign: "center" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
