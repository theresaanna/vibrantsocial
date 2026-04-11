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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";

interface BlockedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId?: string | null;
}

function UnblockButton({
  userId,
  onUnblocked,
}: {
  userId: string;
  onUnblocked: () => void;
}) {
  const [isUnblocking, setIsUnblocking] = useState(false);

  async function handleUnblock() {
    setIsUnblocking(true);
    try {
      await api.rpc("toggleBlock", userId);
      onUnblocked();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to unblock user"
      );
    } finally {
      setIsUnblocking(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={handleUnblock}
      disabled={isUnblocking}
      style={{
        borderWidth: 1,
        borderColor: "#fecaca",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        opacity: isUnblocking ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "600" }}>
        {isUnblocking ? "..." : "Unblock"}
      </Text>
    </TouchableOpacity>
  );
}

export default function BlockedUsersScreen() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: () => api.rpc<BlockedUser[]>("getBlockedUsers"),
  });

  const handleUnblocked = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
  }, [queryClient]);

  return (
    <>
      <Stack.Screen options={{ title: "Blocked Users" }} />
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
              You haven't blocked anyone.
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
                  <UnblockButton
                    userId={item.id}
                    onUnblocked={handleUnblocked}
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
