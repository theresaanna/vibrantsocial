import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/date";
import type { MessageRequestData, ActionState } from "@vibrantsocial/shared/types";

export default function MessageRequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["messageRequests"],
    queryFn: () => api.rpc<MessageRequestData[]>("getMessageRequests"),
  });

  const requests = data ?? [];

  const acceptRequest = useMutation({
    mutationFn: (conversationId: string) =>
      api.rpc<ActionState>("acceptMessageRequest", conversationId),
    onSuccess: (result, conversationId) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["messageRequests"] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        router.push(`/(tabs)/chat/${conversationId}`);
      }
    },
  });

  const declineRequest = useMutation({
    mutationFn: (conversationId: string) =>
      api.rpc<ActionState>("declineMessageRequest", conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messageRequests"] });
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlashList
        data={requests}
        estimatedItemSize={100}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const sender = item.sender;
          const name =
            sender.displayName ?? sender.username ?? sender.name ?? "Unknown";
          const avatar = sender.avatar ?? sender.image;
          const isPending =
            acceptRequest.isPending || declineRequest.isPending;

          return (
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Image
                  source={{ uri: avatar ?? undefined }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#e5e7eb",
                  }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: "600", fontSize: 15, color: "#1f2937" }}>
                    {name}
                  </Text>
                  {sender.username && (
                    <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 1 }}>
                      @{sender.username}
                    </Text>
                  )}
                  <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
                    {formatDistanceToNow(new Date(item.createdAt))}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: 12,
                  marginLeft: 60,
                }}
              >
                <TouchableOpacity
                  onPress={() => acceptRequest.mutate(item.id)}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    backgroundColor: "#c026d3",
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    opacity: isPending ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                    Accept
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => declineRequest.mutate(item.id)}
                  disabled={isPending}
                  style={{
                    flex: 1,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    opacity: isPending ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 14 }}>
                    Decline
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 16 }}>
              No message requests
            </Text>
          </View>
        }
      />
    </View>
  );
}
