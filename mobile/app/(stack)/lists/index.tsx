import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";

interface UserList {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export default function ListsScreen() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["lists"],
    queryFn: () => api.rpc<{ lists: UserList[] }>("fetchAllUserLists"),
  });

  const lists = data?.lists ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlashList
        data={lists}
        estimatedItemSize={80}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(stack)/lists/${item.id}`)}
            activeOpacity={0.7}
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <Text style={{ fontWeight: "600", fontSize: 16, color: "#1f2937" }}>
              {item.name}
            </Text>
            {item.description && (
              <Text
                numberOfLines={1}
                style={{ color: "#6b7280", fontSize: 14, marginTop: 2 }}
              >
                {item.description}
              </Text>
            )}
            <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
              {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No lists yet</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
              Create a list to organize your timeline
            </Text>
          </View>
        }
      />
    </View>
  );
}
