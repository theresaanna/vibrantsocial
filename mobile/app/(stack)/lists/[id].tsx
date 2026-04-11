import { View, Text, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";

interface ListMember {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
}

interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  members: ListMember[];
}

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["listMembers", id],
    queryFn: () => api.rpc<ListDetail>("fetchListMembers", id),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  const members = data?.members ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* List header */}
      {data && (
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>
            {data.name}
          </Text>
          {data.description && (
            <Text style={{ color: "#6b7280", fontSize: 14, marginTop: 4, lineHeight: 20 }}>
              {data.description}
            </Text>
          )}
          <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </Text>
        </View>
      )}

      <FlashList
        data={members}
        estimatedItemSize={72}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <UserListItem user={item} />}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No members in this list</Text>
          </View>
        }
      />
    </View>
  );
}
