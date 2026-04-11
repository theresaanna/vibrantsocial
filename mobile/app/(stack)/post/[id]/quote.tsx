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
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/date";
import Toast from "react-native-toast-message";

export default function QuotePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.rpc<any>("fetchSinglePost", id),
  });

  const quotePost = useMutation({
    mutationFn: async () => {
      const editorState = {
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: content,
                  type: "text",
                  version: 1,
                },
              ],
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

      return api.rpc("createQuoteRepost", {
        postId: id,
        content: JSON.stringify(editorState),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      Toast.show({ type: "success", text1: "Quote posted!" });
      router.back();
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to create quote post" });
    },
  });

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  const author = post.author;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#6b7280", fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => quotePost.mutate()}
            disabled={quotePost.isPending || !content.trim()}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 8,
              opacity: quotePost.isPending || !content.trim() ? 0.5 : 1,
            }}
          >
            {quotePost.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600" }}>Quote</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }}>
          {/* Quote text input */}
          <TextInput
            placeholder="Add your thoughts..."
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            style={{
              fontSize: 18,
              minHeight: 80,
              textAlignVertical: "top",
              marginBottom: 16,
            }}
          />

          {/* Embedded original post */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 12,
              backgroundColor: "#fafafa",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Image
                source={{ uri: author?.avatar ?? undefined }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#e5e7eb",
                }}
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={{ fontWeight: "600", fontSize: 14 }}>
                  {author?.displayName || author?.username}
                </Text>
                {author?.username && (
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                    @{author.username}
                  </Text>
                )}
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                {formatDistanceToNow(new Date(post.createdAt))}
              </Text>
            </View>

            <Text
              style={{ fontSize: 14, lineHeight: 20, color: "#374151" }}
              numberOfLines={6}
            >
              {extractPlainText(post.content)}
            </Text>

            {post.media?.length > 0 && (
              <Image
                source={{ uri: post.media[0].url }}
                style={{
                  width: "100%",
                  aspectRatio: 16 / 9,
                  borderRadius: 8,
                  marginTop: 8,
                }}
                contentFit="cover"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function extractPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const texts: string[] = [];
    function walk(node: { text?: string; children?: unknown[] }) {
      if (node.text) texts.push(node.text);
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child as typeof node);
        }
      }
    }
    walk(parsed.root ?? parsed);
    return texts.join(" ").trim();
  } catch {
    return content;
  }
}
