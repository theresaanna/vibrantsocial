import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";
import { useDebounce } from "@/hooks/use-debounce";

interface FriendUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
}

interface CloseFriendEntry {
  id: string;
  friendId: string;
  friend: FriendUser;
}

export default function CloseFriendsScreen() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: closeFriendsData, isLoading } = useQuery({
    queryKey: ["closeFriends"],
    queryFn: () => api.rpc<CloseFriendEntry[]>("getCloseFriends"),
  });

  const { data: allFriendsData } = useQuery({
    queryKey: ["acceptedFriends"],
    queryFn: () => api.rpc<FriendUser[]>("getAcceptedFriends"),
  });

  const closeFriends = closeFriendsData ?? [];
  const closeFriendIds = new Set(closeFriends.map((cf) => cf.friend.id));

  // Filter available friends (not already close friends, matching search)
  const availableFriends = (allFriendsData ?? []).filter((f) => {
    if (closeFriendIds.has(f.id)) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      f.username?.toLowerCase().includes(q) ||
      f.displayName?.toLowerCase().includes(q)
    );
  });

  const addMutation = useMutation({
    mutationFn: (friendId: string) => api.rpc("addCloseFriend", friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closeFriends"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (friendId: string) => api.rpc("removeCloseFriend", friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closeFriends"] });
    },
  });

  const handleRemove = useCallback(
    (friendId: string, name: string) => {
      Alert.alert(
        "Remove Close Friend",
        `Remove ${name} from your close friends?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeMutation.mutate(friendId),
          },
        ]
      );
    },
    [removeMutation]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Explanation */}
      <View style={{ padding: 16, backgroundColor: "#faf5ff", borderBottomWidth: 1, borderBottomColor: "#f3e8ff" }}>
        <Text style={{ fontSize: 14, color: "#7e22ce", lineHeight: 20 }}>
          Close friends see your close-friends-only posts. Only mutual friends can be added.
        </Text>
      </View>

      {/* Current close friends */}
      {closeFriends.length > 0 && (
        <View>
          <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" }}>
            Close Friends ({closeFriends.length})
          </Text>
          {closeFriends.map((cf) => (
            <UserListItem
              key={cf.id}
              user={cf.friend}
              actionButton={
                <TouchableOpacity
                  onPress={() =>
                    handleRemove(
                      cf.friend.id,
                      cf.friend.displayName || cf.friend.username || "this user"
                    )
                  }
                  disabled={removeMutation.isPending}
                  style={{
                    backgroundColor: "#fef2f2",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
                    Remove
                  </Text>
                </TouchableOpacity>
              }
            />
          ))}
        </View>
      )}

      {/* Search & add section */}
      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase" }}>
        Add Friends
      </Text>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TextInput
          placeholder="Search friends..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <FlashList
        data={availableFriends}
        estimatedItemSize={72}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem
            user={item}
            actionButton={
              <TouchableOpacity
                onPress={() => addMutation.mutate(item.id)}
                disabled={addMutation.isPending}
                style={{
                  backgroundColor: "#c026d3",
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                  Add
                </Text>
              </TouchableOpacity>
            }
          />
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>
              {debouncedSearch
                ? "No matching friends found"
                : "All your friends are already close friends"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
