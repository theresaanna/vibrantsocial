import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";

interface MutedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId?: string | null;
}

function UnmuteButton({
  userId,
  onUnmuted,
}: {
  userId: string;
  onUnmuted: () => void;
}) {
  const [isUnmuting, setIsUnmuting] = useState(false);

  async function handleUnmute() {
    setIsUnmuting(true);
    try {
      await api.rpc("toggleMute", userId);
      onUnmuted();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to unmute user"
      );
    } finally {
      setIsUnmuting(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={handleUnmute}
      disabled={isUnmuting}
      style={{
        borderWidth: 1,
        borderColor: "#fde68a",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        opacity: isUnmuting ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#d97706", fontSize: 14, fontWeight: "600" }}>
        {isUnmuting ? "..." : "Unmute"}
      </Text>
    </TouchableOpacity>
  );
}

export default function MutedUsersScreen() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["muted-users"],
    queryFn: () => api.rpc<MutedUser[]>("getMutedUsers"),
  });

  const handleUnmuted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["muted-users"] });
  }, [queryClient]);

  return (
    <>
      <Stack.Screen options={{ title: "Muted Users" }} />
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {isLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color="#c026d3" />
          </View>
        ) : users.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 16 }}>
              You haven't muted anyone.
            </Text>
          </View>
        ) : (
          <FlashList
            data={users}
            estimatedItemSize={72}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserListItem
                user={item}
                actionButton={
                  <UnmuteButton
                    userId={item.id}
                    onUnmuted={handleUnmuted}
                  />
                }
              />
            )}
          />
        )}
      </View>
    </>
  );
}
