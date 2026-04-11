import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import type { ChatUserProfile } from "@vibrantsocial/shared/types";

type Tab = "direct" | "group";

export default function NewConversationScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("direct");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ChatUserProfile[]>([]);

  const debouncedSearch = useDebounce(search, 300);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["searchUsers", debouncedSearch],
    queryFn: () =>
      api.rpc<ChatUserProfile[]>("searchUsers", debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const startDirect = useMutation({
    mutationFn: (userId: string) =>
      api.rpc<{ success: boolean; conversationId?: string; message: string }>(
        "startConversation",
        userId
      ),
    onSuccess: (result) => {
      if (result.success && result.conversationId) {
        router.replace(`/(tabs)/chat/${result.conversationId}`);
      } else {
        Alert.alert("Info", result.message);
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const createGroup = useMutation({
    mutationFn: () =>
      api.rpc<{ success: boolean; conversationId?: string; message: string }>(
        "createGroupConversation",
        {
          name: groupName,
          participantIds: selectedUsers.map((u) => u.id),
        }
      ),
    onSuccess: (result) => {
      if (result.success && result.conversationId) {
        router.replace(`/(tabs)/chat/${result.conversationId}`);
      } else {
        Alert.alert("Info", result.message);
      }
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const handleSelectUser = (user: ChatUserProfile) => {
    if (tab === "direct") {
      startDirect.mutate(user.id);
    } else {
      if (!selectedUsers.some((u) => u.id === user.id)) {
        setSelectedUsers((prev) => [...prev, user]);
      }
      setSearch("");
    }
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const filteredResults = searchResults.filter(
    (u) => !selectedUsers.some((s) => s.id === u.id)
  );

  const isPending = startDirect.isPending || createGroup.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Tab switcher */}
      <View
        style={{
          flexDirection: "row",
          margin: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        {(["direct", "group"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => {
              setTab(t);
              setSelectedUsers([]);
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              backgroundColor: tab === t ? "#c026d3" : "#fff",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: tab === t ? "#fff" : "#6b7280",
              }}
            >
              {t === "direct" ? "Direct Message" : "Group Chat"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Group name input */}
      {tab === "group" && (
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          maxLength={100}
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            backgroundColor: "#f9fafb",
          }}
        />
      )}

      {/* Selected users chips */}
      {tab === "group" && selectedUsers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, marginBottom: 8 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {selectedUsers.map((user) => {
            const name = user.displayName ?? user.username ?? "User";
            return (
              <View
                key={user.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f3e8ff",
                  borderRadius: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: "#7c3aed", marginRight: 4 }}>
                  {name}
                </Text>
                <TouchableOpacity onPress={() => removeUser(user.id)}>
                  <Text style={{ color: "#9ca3af", fontSize: 16 }}>{"\u2715"}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Search input */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === "group" ? "Search users to add..." : "Search users..."}
        autoFocus
        style={{
          marginHorizontal: 16,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 15,
          backgroundColor: "#f9fafb",
        }}
      />

      {/* Search results */}
      <ScrollView style={{ flex: 1 }}>
        {isSearching && (
          <ActivityIndicator color="#c026d3" style={{ marginTop: 20 }} />
        )}

        {filteredResults.map((user) => {
          const name = user.displayName ?? user.username ?? "User";
          const avatar = user.avatar ?? user.image;
          return (
            <TouchableOpacity
              key={user.id}
              onPress={() => handleSelectUser(user)}
              disabled={isPending}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              <Image
                source={{ uri: avatar ?? undefined }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#e5e7eb",
                }}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: "600", fontSize: 15, color: "#1f2937" }}>
                  {name}
                </Text>
                {user.username && (
                  <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 1 }}>
                    @{user.username}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {debouncedSearch.length >= 2 &&
          !isSearching &&
          filteredResults.length === 0 && (
            <Text
              style={{
                textAlign: "center",
                color: "#9ca3af",
                marginTop: 24,
                fontSize: 15,
              }}
            >
              No users found
            </Text>
          )}
      </ScrollView>

      {/* Create group button */}
      {tab === "group" && selectedUsers.length >= 2 && (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
          <TouchableOpacity
            onPress={() => createGroup.mutate()}
            disabled={!groupName.trim() || isPending}
            style={{
              backgroundColor:
                groupName.trim() && !isPending ? "#c026d3" : "#e5e7eb",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Create Group ({selectedUsers.length} members)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
