import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";
import { PollCreator, type PollCreatorData } from "@/components/poll-creator";
import { RichTextEditor, type RichTextEditorRef } from "@/components/rich-text-editor";
import { ComposeToolbar } from "@/components/compose-toolbar";
import { useUserTheme, ScreenBackground } from "@/components/themed-view";

type AudienceType = "public" | "friends" | "close_friends";

export default function ComposeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useUserTheme();
  const editorRef = useRef<RichTextEditorRef>(null);

  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // Post meta state
  const [isNsfw, setIsNsfw] = useState(false);
  const [audience, setAudience] = useState<AudienceType>("public");
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pollData, setPollData] = useState<PollCreatorData | null>(null);
  const [youtubeIds, setYoutubeIds] = useState<string[]>([]);

  const createPost = useMutation({
    mutationFn: async (lexicalJson: string) => {
      // Upload images
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

      // Build the editor state and append media nodes
      const editorState = JSON.parse(lexicalJson);
      for (const url of mediaUrls) {
        editorState.root.children.push({
          children: [{
            type: "image",
            src: url,
            altText: "",
            width: "inherit",
            height: "inherit",
            version: 1,
          }],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        });
      }
      // Append YouTube embeds
      for (const videoID of youtubeIds) {
        editorState.root.children.push({
          type: "youtube",
          videoID,
          version: 1,
        });
      }

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
      editorRef.current?.clear();
      setImages([]);
      setYoutubeIds([]);
      setIsNsfw(false);
      setAudience("public");
      setScheduledFor(null);
      setPollData(null);
      setHasContent(false);
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

  function handleSubmit() {
    const lexicalJson = editorRef.current?.getContent();
    if (lexicalJson) {
      createPost.mutate(lexicalJson);
    }
  }

  // Track whether editor has content (text or images/embeds)
  const handleEditorChange = useCallback((html: string) => {
    const text = html.replace(/<[^>]*>/g, "").trim();
    const hasMedia = html.includes("<img") || html.includes("data-youtube");
    setHasContent(text.length > 0 || hasMedia);
  }, []);

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
  const canSubmit =
    hasContent ||
    images.length > 0 ||
    youtubeIds.length > 0 ||
    (pollData && pollData.question.trim() && pollData.options.filter((o) => o.trim()).length >= 2);

  const audienceLabel =
    audience === "public"
      ? "Public"
      : audience === "friends"
        ? "Friends Only"
        : "Close Friends";

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <ScreenBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.secondaryColor + "33",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: theme.secondaryColor, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Audience badge in header */}
            {audience !== "public" && (
              <View style={{
                backgroundColor: theme.linkColor + "22",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
                <Text style={{ color: theme.linkColor, fontSize: 11, fontWeight: "600" }}>
                  {audienceLabel}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              style={{
                backgroundColor: theme.linkColor,
                borderRadius: 20,
                paddingHorizontal: 20,
                paddingVertical: 8,
                opacity: isSubmitting || !canSubmit ? 0.5 : 1,
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
        </View>

        {/* Indicators row */}
        {(scheduledFor || isNsfw) && (
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
            {scheduledFor && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f0fdf4",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 12, color: "#16a34a" }}>
                  {scheduledFor.toLocaleDateString()} {scheduledFor.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <TouchableOpacity onPress={() => setScheduledFor(null)} hitSlop={8}>
                  <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "700" }}>X</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {isNsfw && (
              <View style={{
                backgroundColor: "#fef2f2",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
                <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600" }}>NSFW</Text>
              </View>
            )}
          </View>
        )}

        {/* Editor area */}
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        >
          <RichTextEditor
            ref={editorRef}
            onChange={handleEditorChange}
            placeholder="What's on your mind?"
            minHeight={200}
            autoFocus
          />

          {/* Image previews */}
          {images.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
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

          {/* YouTube previews */}
          {youtubeIds.length > 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              {youtubeIds.map((vid, i) => (
                <View key={vid} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${vid}/hqdefault.jpg` }}
                    style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <View style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)",
                  }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      backgroundColor: "rgba(255,0,0,0.9)",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <View style={{
                        width: 0, height: 0,
                        borderLeftWidth: 18, borderTopWidth: 11, borderBottomWidth: 11,
                        borderLeftColor: "#fff", borderTopColor: "transparent", borderBottomColor: "transparent",
                        marginLeft: 4,
                      }} />
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setYoutubeIds((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      backgroundColor: "#000", borderRadius: 10,
                      width: 20, height: 20, alignItems: "center", justifyContent: "center",
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
            <View style={{ marginTop: 12 }}>
              <PollCreator
                data={pollData}
                onChange={setPollData}
                onRemove={() => setPollData(null)}
              />
            </View>
          )}
        </ScrollView>

        {/* Toolbar */}
        <ComposeToolbar
          editorRef={editorRef}
          onPickImage={pickImage}
          onTogglePoll={togglePoll}
          onToggleNsfw={() => setIsNsfw((v) => !v)}
          onPickAudience={() => setShowAudienceMenu(true)}
          onInsertYouTube={(videoID) => setYoutubeIds((prev) => [...prev, videoID])}
          onSchedule={() => setShowDatePicker(true)}
          imageCount={images.length}
          isNsfw={isNsfw}
          hasPoll={!!pollData}
          hasSchedule={!!scheduledFor}
        />
      </KeyboardAvoidingView>

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
              backgroundColor: theme.backgroundColor || "#fff",
              borderRadius: 16,
              width: 280,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.secondaryColor + "22",
              }}
            >
              <Text style={{ fontWeight: "600", fontSize: 16, color: theme.textColor }}>
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
                  borderBottomColor: theme.secondaryColor + "22",
                  backgroundColor:
                    audience === option.key ? theme.linkColor + "11" : "transparent",
                }}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>
                  {option.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: theme.textColor }}>
                    {option.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.secondaryColor }}>
                    {option.description}
                  </Text>
                </View>
                {audience === option.key && (
                  <Text style={{ color: theme.linkColor, fontSize: 16, fontWeight: "700" }}>
                    {"\u2713"}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowAudienceMenu(false)}
              style={{ paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: 15, color: theme.secondaryColor, textAlign: "center" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
