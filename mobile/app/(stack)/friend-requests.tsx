import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";
import Toast from "react-native-toast-message";

type RequestTab = "incoming" | "outgoing";

interface FriendRequest {
  id: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  };
  receiver: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  };
}

export default function FriendRequestsScreen() {
  const [activeTab, setActiveTab] = useState<RequestTab>("incoming");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: () =>
      api.rpc<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("getFriendRequests"),
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => api.rpc("acceptFriendRequest", requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      Toast.show({ type: "success", text1: "Friend request accepted" });
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to accept request" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.rpc("declineFriendRequest", requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      Toast.show({ type: "success", text1: "Friend request declined" });
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to decline request" });
    },
  });

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const requests = activeTab === "incoming" ? incoming : outgoing;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Tab switcher */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
          paddingHorizontal: 16,
        }}
      >
        {(["incoming", "outgoing"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? "#c026d3" : "transparent",
            }}
          >
            <Text
              style={{
                fontWeight: activeTab === tab ? "600" : "400",
                color: activeTab === tab ? "#c026d3" : "#6b7280",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color="#c026d3" />
        </View>
      ) : (
        <FlashList
          data={requests}
          estimatedItemSize={72}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const user = activeTab === "incoming" ? item.sender : item.receiver;
            return (
              <UserListItem
                user={user}
                actionButton={
                  activeTab === "incoming" ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => acceptMutation.mutate(item.id)}
                        disabled={acceptMutation.isPending}
                        style={{
                          backgroundColor: "#c026d3",
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                          Accept
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => declineMutation.mutate(item.id)}
                        disabled={declineMutation.isPending}
                        style={{
                          backgroundColor: "#f3f4f6",
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 13 }}>
                          Decline
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: "#f3f4f6",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 13 }}>Pending</Text>
                    </View>
                  )
                }
              />
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>
                {activeTab === "incoming"
                  ? "No incoming friend requests"
                  : "No outgoing friend requests"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
