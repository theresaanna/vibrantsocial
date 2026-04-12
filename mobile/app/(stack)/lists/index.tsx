import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";
import { useUserTheme, ScreenBackground } from "@/components/themed-view";
import { hexToRgba } from "@/lib/user-theme";

// ── Types ─────────────────────────────────────────────────────────

interface OwnedList {
  id: string;
  name: string;
  _count: { members: number };
}

interface CollaboratingList {
  id: string;
  name: string;
  _count: { members: number };
  owner: {
    username: string | null;
    displayName: string | null;
    name: string | null;
  };
}

// ── Screen ────────────────────────────────────────────────────────

export default function ListsScreen() {
  const theme = useUserTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newListName, setNewListName] = useState("");

  const containerBg = hexToRgba(theme.containerColor, theme.containerOpacity);

  // Fetch owned lists
  const {
    data: ownedLists,
    isLoading: loadingOwned,
    refetch: refetchOwned,
    isRefetching: refetchingOwned,
  } = useQuery({
    queryKey: ["userLists"],
    queryFn: () => api.rpc<OwnedList[]>("getUserLists"),
  });

  // Fetch collaborating lists
  const {
    data: collabLists,
    isLoading: loadingCollab,
    refetch: refetchCollab,
    isRefetching: refetchingCollab,
  } = useQuery({
    queryKey: ["collaboratingLists"],
    queryFn: () => api.rpc<CollaboratingList[]>("getCollaboratingLists"),
  });

  // Create list
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.rpc<{ success: boolean; message: string; listId?: string }>("createList", name),
    onSuccess: (result) => {
      if (result.success) {
        setNewListName("");
        queryClient.invalidateQueries({ queryKey: ["userLists"] });
        Toast.show({ type: "success", text1: "List created" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to create list" });
    },
  });

  // Delete list
  const deleteMutation = useMutation({
    mutationFn: (listId: string) =>
      api.rpc<{ success: boolean; message: string }>("deleteList", listId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["userLists"] });
        Toast.show({ type: "success", text1: "List deleted" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleDelete = (list: OwnedList) => {
    Alert.alert(
      "Delete list?",
      "This will permanently delete this list and remove all members. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(list.id),
        },
      ]
    );
  };

  const handleShare = async (list: OwnedList | CollaboratingList) => {
    try {
      await Share.share({
        message: `Check out this list on VibrantSocial: ${list.name}`,
        url: `https://www.vibrantsocial.app/lists/${list.id}`,
      });
    } catch {
      // User cancelled
    }
  };

  const isLoading = loadingOwned || loadingCollab;
  const isRefetching = refetchingOwned || refetchingCollab;

  const onRefresh = () => {
    refetchOwned();
    refetchCollab();
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.linkColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.linkColor} />
        }
      >
        {/* Header */}
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.linkColor,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{"\u2630"}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: theme.textColor }}>Lists</Text>
            <Text style={{ fontSize: 13, color: theme.secondaryColor }}>
              Create lists to organize your feed
            </Text>
          </View>
        </View>

        {/* Create list form */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", gap: 8 }}>
          <TextInput
            value={newListName}
            onChangeText={setNewListName}
            placeholder="New list name..."
            placeholderTextColor={theme.secondaryColor}
            maxLength={50}
            style={{
              flex: 1,
              backgroundColor: containerBg,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: theme.textColor,
            }}
          />
          <TouchableOpacity
            onPress={handleCreate}
            disabled={createMutation.isPending || !newListName.trim()}
            style={{
              backgroundColor: theme.linkColor,
              borderRadius: 10,
              paddingHorizontal: 18,
              justifyContent: "center",
              opacity: createMutation.isPending || !newListName.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              {createMutation.isPending ? "..." : "Create"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Owned lists */}
        {!ownedLists?.length ? (
          <View
            style={{
              marginHorizontal: 16,
              backgroundColor: containerBg,
              borderRadius: 14,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.secondaryColor, fontSize: 16, fontWeight: "600" }}>
              No lists yet.
            </Text>
            <Text style={{ color: theme.secondaryColor, fontSize: 14, marginTop: 4 }}>
              Create a list above to start organizing your feed.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {ownedLists.map((list) => (
              <View
                key={list.id}
                style={{
                  backgroundColor: containerBg,
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <TouchableOpacity
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => router.push(`/(stack)/lists/${list.id}`)}
                >
                  <Text
                    style={{ fontWeight: "600", fontSize: 15, color: theme.textColor }}
                    numberOfLines={1}
                  >
                    {list.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.secondaryColor, marginTop: 2 }}>
                    {list._count.members} {list._count.members === 1 ? "member" : "members"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleShare(list)}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.secondaryColor + "44",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: theme.secondaryColor }}>
                    Share
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    router.back();
                    // Small delay to let the navigation settle, then the list tab will be available
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.secondaryColor + "44",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: theme.secondaryColor }}>
                    View Feed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(list)}
                  disabled={deleteMutation.isPending}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.secondaryColor + "44",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: "#ef4444" }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Collaborating lists */}
        <View style={{ marginTop: 24, paddingHorizontal: 16, paddingBottom: 32 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: theme.secondaryColor,
                marginBottom: 10,
              }}
            >
              Collaborating
            </Text>
            {(collabLists ?? []).length === 0 ? (
              <View
                style={{
                  backgroundColor: containerBg,
                  borderRadius: 14,
                  padding: 24,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.secondaryColor, fontSize: 14 }}>
                  No collaborating lists yet.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {(collabLists ?? []).map((list) => {
                  const ownerName =
                    list.owner.displayName ?? list.owner.username ?? list.owner.name ?? "Unknown";
                  return (
                    <View
                      key={list.id}
                      style={{
                        backgroundColor: containerBg,
                        borderRadius: 14,
                        padding: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{ flex: 1, minWidth: 0 }}
                        onPress={() => router.push(`/(stack)/lists/${list.id}`)}
                      >
                        <Text
                          style={{ fontWeight: "600", fontSize: 15, color: theme.textColor }}
                          numberOfLines={1}
                        >
                          {list.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.secondaryColor, marginTop: 2 }}>
                          {list._count.members} {list._count.members === 1 ? "member" : "members"}
                          {" · "}by {ownerName}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleShare(list)}
                        style={{
                          borderWidth: 1,
                          borderColor: theme.secondaryColor + "44",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "500", color: theme.secondaryColor }}>
                          Share
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => router.push(`/(stack)/lists/${list.id}`)}
                        style={{
                          borderWidth: 1,
                          borderColor: theme.secondaryColor + "44",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "500", color: theme.secondaryColor }}>
                          View Feed
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
