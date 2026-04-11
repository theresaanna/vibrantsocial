import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface WallPostComposerProps {
  wallOwnerId: string;
  wallOwnerName: string;
}

export function WallPostComposer({ wallOwnerId, wallOwnerName }: WallPostComposerProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const postMutation = useMutation({
    mutationFn: (text: string) =>
      api.rpc("createWallPost", { wallOwnerId, content: text }),
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["wallPosts", wallOwnerId] });
    },
  });

  function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    postMutation.mutate(trimmed);
  }

  return (
    <View
      style={{
        backgroundColor: "#faf5ff",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "#f3e8ff",
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c3aed" }}>
          Write on {wallOwnerName}&apos;s wall
        </Text>
      </View>

      {/* Input */}
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={`Write something on ${wallOwnerName}'s wall...`}
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={5000}
          textAlignVertical="top"
          style={{
            fontSize: 15,
            color: "#1f2937",
            minHeight: 60,
            lineHeight: 22,
          }}
        />

        {postMutation.isError && (
          <Text style={{ color: "#ef4444", fontSize: 12 }}>
            {(postMutation.error as Error)?.message ?? "Failed to post"}
          </Text>
        )}

        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!content.trim() || postMutation.isPending}
            style={{
              backgroundColor: content.trim() ? "#c026d3" : "#e5e7eb",
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            {postMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                style={{
                  color: content.trim() ? "#fff" : "#9ca3af",
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Post to Wall
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
