import { useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter, useNavigation } from "expo-router";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/date";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import type { ConversationListItem } from "@vibrantsocial/shared/types";

function GroupAvatars({
  participants,
}: {
  participants: ConversationListItem["participants"];
}) {
  const avatars = participants
    .slice(0, 3)
    .map((p) => p.avatar ?? p.image);

  return (
    <View style={{ width: 48, height: 48, position: "relative" }}>
      {avatars.map((uri, i) => (
        <Image
          key={i}
          source={{ uri: uri ?? undefined }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#e5e7eb",
            position: "absolute",
            top: i === 0 ? 0 : i === 1 ? 10 : 20,
            left: i === 0 ? 0 : i === 1 ? 16 : 8,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      ))}
    </View>
  );
}

export default function ConversationListScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  // Set up header with "New chat" button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/chat/new")}
          style={{ marginRight: 16 }}
        >
          <Text style={{ color: "#c026d3", fontSize: 16, fontWeight: "600" }}>
            New
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.rpc<ConversationListItem[]>("getConversations"),
  });

  const { data: requestCount = 0 } = useQuery({
    queryKey: ["messageRequestCount"],
    queryFn: async () => {
      const requests = await api.rpc<{ length: number } & unknown[]>(
        "getMessageRequests"
      );
      return Array.isArray(requests) ? requests.length : 0;
    },
  });

  const conversations = data ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  return (
    <FlashList
      data={conversations}
      estimatedItemSize={72}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        requestCount > 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/chat/requests")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
              backgroundColor: "#fdf4ff",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#1f2937" }}>
                Message Requests
              </Text>
              <View
                style={{
                  backgroundColor: "#c026d3",
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                  marginLeft: 8,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {requestCount}
                </Text>
              </View>
            </View>
            <Text style={{ color: "#9ca3af", fontSize: 18 }}>{"\u203A"}</Text>
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item }) => {
        const displayName = item.isGroup
          ? item.name
          : item.participants[0]?.displayName ||
            item.participants[0]?.username;
        const avatar = item.isGroup
          ? null
          : item.participants[0]?.avatar || item.participants[0]?.image;

        return (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            {/* Avatar: stacked for groups, single for DMs */}
            {item.isGroup ? (
              <GroupAvatars participants={item.participants} />
            ) : (
              <FramedAvatar
                uri={avatar}
                size={48}
                frameId={item.participants[0]?.profileFrameId}
              />
            )}

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <StyledName
                    fontId={item.isGroup ? null : item.participants[0]?.usernameFont}
                    style={{
                      fontWeight: item.unreadCount > 0 ? "700" : "600",
                      fontSize: 15,
                      color: "#1f2937",
                    }}
                  >
                    {displayName}
                  </StyledName>
                </View>
                {item.lastMessage && (
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                    {formatDistanceToNow(new Date(item.lastMessage.createdAt))}
                  </Text>
                )}
              </View>
              {item.lastMessage && (
                <Text
                  style={{
                    color: item.unreadCount > 0 ? "#1f2937" : "#6b7280",
                    fontWeight: item.unreadCount > 0 ? "600" : "400",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {item.lastMessage.mediaType
                    ? `[${item.lastMessage.mediaType}]`
                    : item.lastMessage.content}
                </Text>
              )}
            </View>

            {/* Unread badge */}
            {item.unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: "#c026d3",
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}
                >
                  {item.unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={{ padding: 32, alignItems: "center" }}>
          <Text style={{ color: "#9ca3af", fontSize: 16 }}>
            No messages yet
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/chat/new")}
            style={{
              marginTop: 16,
              backgroundColor: "#c026d3",
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Start a conversation
            </Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}
