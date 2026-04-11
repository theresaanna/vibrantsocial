import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";

interface TagSubscription {
  tagId: string;
  tagName: string;
  postCount: number;
}

interface TagSubscriptionsResponse {
  subscriptions: TagSubscription[];
}

export default function TagSubscriptionsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["tagSubscriptions"],
    queryFn: () => api.rpc<TagSubscriptionsResponse>("getTagSubscriptions"),
  });

  const unsubscribe = useMutation({
    mutationFn: (tagId: string) => api.rpc("toggleTagSubscription", tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagSubscriptions"] });
    },
  });

  const subscriptions = data?.subscriptions ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlashList
        data={subscriptions}
        estimatedItemSize={60}
        keyExtractor={(item) => item.tagId}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(stack)/tag/${item.tagName}`)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>
                #{item.tagName}
              </Text>
              <Text style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                {item.postCount} {item.postCount === 1 ? "post" : "posts"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => unsubscribe.mutate(item.tagId)}
              disabled={unsubscribe.isPending}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 13 }}>
                Unsubscribe
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15, marginBottom: 8 }}>
              No tag subscriptions yet
            </Text>
            <Text style={{ color: "#d1d5db", fontSize: 13, textAlign: "center" }}>
              Subscribe to tags from post hashtags or the search page to see them here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
