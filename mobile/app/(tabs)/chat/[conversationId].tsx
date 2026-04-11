import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FramedAvatar } from "@/components/framed-avatar";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useReadReceipts } from "@/hooks/use-read-receipts";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { MessageBubble } from "@/components/chat/message-bubble";
import { VoiceRecorder } from "@/components/chat/voice-recorder";
import type {
  MessageData,
  ConversationWithParticipants,
  ChatUserProfile,
} from "@vibrantsocial/shared/types";

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);

  // Fetch conversation details (for group header, participants)
  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () =>
      api.rpc<ConversationWithParticipants>(
        "getConversationDetails",
        conversationId
      ),
    enabled: !!conversationId,
  });

  // Build participants map for typing indicator
  const participantsMap = useMemo(() => {
    const map = new Map<string, ChatUserProfile>();
    if (conversation?.participants) {
      for (const p of conversation.participants) {
        map.set(p.userId, p.user);
      }
    }
    return map;
  }, [conversation]);

  // Set up header for group chats
  useEffect(() => {
    if (!conversation) return;

    if (conversation.isGroup) {
      const avatars = conversation.participants
        .slice(0, 3)
        .map((p) => p.user.avatar ?? p.user.image);

      navigation.setOptions({
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flexDirection: "row", marginRight: 8 }}>
              {avatars.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri: uri ?? undefined }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#e5e7eb",
                    marginLeft: i > 0 ? -8 : 0,
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />
              ))}
            </View>
            <Text
              style={{ fontWeight: "600", fontSize: 16 }}
              numberOfLines={1}
            >
              {conversation.name || "Group Chat"}
            </Text>
          </View>
        ),
      });
    } else {
      const otherParticipant = conversation.participants.find(
        (p) => p.userId !== user?.id
      );
      if (otherParticipant) {
        const name =
          otherParticipant.user.displayName ??
          otherParticipant.user.username ??
          "Chat";
        navigation.setOptions({ title: name });
      }
    }
  }, [conversation, navigation, user?.id]);

  // Messages query
  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      api.rpc<{ messages: MessageData[]; nextCursor: string | null }>(
        "getMessages",
        conversationId,
        pageParam
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const messages = data?.pages.flatMap((p) => p.messages) ?? [];

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    conversationId!,
    user?.id ?? ""
  );

  // Read receipts
  const { publishRead, getReadStatus } = useReadReceipts(conversationId!);

  // Mark conversation as read when opening
  useEffect(() => {
    if (user?.id && conversationId) {
      api.rpc("markConversationRead", conversationId).catch(() => {});
      publishRead(user.id);
    }
  }, [conversationId, user?.id, publishRead]);

  // Mark as read when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      publishRead(user.id);
    }
  }, [messages.length, user?.id, publishRead]);

  // Send text message
  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api.rpc("sendMessage", { conversationId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Send media message
  const sendMediaMessage = useMutation({
    mutationFn: async ({
      mediaUrl,
      mediaType,
      content,
    }: {
      mediaUrl: string;
      mediaType: string;
      content?: string;
    }) =>
      api.rpc("sendMessage", {
        conversationId,
        content: content || "",
        mediaUrl,
        mediaType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => api.rpc("deleteMessage", messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
    },
  });

  function handleTextChange(value: string) {
    setText(value);
    if (value.trim()) {
      startTyping();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    stopTyping();
    sendMessage.mutate(trimmed);
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      const uploadResult = await api.upload({
        uri: asset.uri,
        name: asset.fileName || "image.jpg",
        type: asset.mimeType || "image/jpeg",
      });
      sendMediaMessage.mutate({
        mediaUrl: uploadResult.url,
        mediaType: "image",
      });
    } catch {
      // Upload failed silently
    }
  }

  async function handleVoiceComplete(uri: string, duration: number) {
    setIsRecording(false);
    try {
      const uploadResult = await api.upload({
        uri,
        name: `voice-${Date.now()}.m4a`,
        type: "audio/m4a",
      });
      sendMediaMessage.mutate({
        mediaUrl: uploadResult.url,
        mediaType: "audio",
        content: `Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})`,
      });
    } catch {
      // Upload failed silently
    }
  }

  function handleCopy(content: string) {
    Clipboard.setStringAsync(content);
  }

  const renderMessage = useCallback(
    ({ item }: { item: MessageData }) => {
      const isMe = item.senderId === user?.id;
      const readStatus = isMe
        ? getReadStatus(new Date(item.createdAt), item.senderId)
        : undefined;

      return (
        <MessageBubble
          message={item}
          isOwn={isMe}
          readStatus={readStatus}
          onDelete={(messageId) => deleteMessage.mutate(messageId)}
          onCopy={handleCopy}
        />
      );
    },
    [user?.id, getReadStatus, deleteMessage]
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
      keyboardVerticalOffset={90}
    >
      <FlashList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        estimatedItemSize={80}
        inverted
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          typingUsers.size > 0 ? (
            <TypingIndicator
              typingUserIds={typingUsers}
              participants={participantsMap}
              currentUserId={user?.id ?? ""}
            />
          ) : null
        }
      />

      {/* Voice recorder overlay */}
      {isRecording ? (
        <View
          style={{
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          }}
        >
          <VoiceRecorder
            onRecordingComplete={handleVoiceComplete}
            onCancel={() => setIsRecording(false)}
          />
        </View>
      ) : (
        /* Input bar */
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 8,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          }}
        >
          {/* Image picker button */}
          <TouchableOpacity
            onPress={handlePickImage}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#f3f4f6",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Text style={{ fontSize: 18, color: "#6b7280" }}>{"\uD83D\uDDBC"}</Text>
          </TouchableOpacity>

          {/* Voice recorder button */}
          <TouchableOpacity
            onPress={() => setIsRecording(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#f3f4f6",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Text style={{ fontSize: 18, color: "#6b7280" }}>{"\uD83C\uDF99"}</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            placeholder="Message..."
            value={text}
            onChangeText={handleTextChange}
            multiline
            style={{
              flex: 1,
              backgroundColor: "#f3f4f6",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 16,
              maxHeight: 120,
            }}
          />

          {/* Send button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={{
              marginLeft: 8,
              backgroundColor: text.trim() ? "#c026d3" : "#e5e7eb",
              borderRadius: 20,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>{"\u2191"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
