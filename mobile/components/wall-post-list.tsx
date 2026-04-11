import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { Avatar } from "@/components/avatar";
import { formatDistanceToNow } from "@/lib/date";

interface WallPost {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
}

interface WallPostListProps {
  wallOwnerId: string;
}

export function WallPostList({ wallOwnerId }: WallPostListProps) {
  const router = useRouter();

  const { data: wallPosts = [], isLoading } = useQuery({
    queryKey: ["wallPosts", wallOwnerId],
    queryFn: () => api.rpc<WallPost[]>("getWallPosts", wallOwnerId),
  });

  if (isLoading) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  if (wallPosts.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text style={{ color: "#9ca3af", fontSize: 14 }}>No wall posts yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ minHeight: 100 }}>
      <FlashList
        data={wallPosts}
        estimatedItemSize={90}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              item.author.username && router.push(`/(stack)/${item.author.username}`)
            }
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              padding: 12,
              marginHorizontal: 16,
              marginBottom: 8,
              backgroundColor: "#f9fafb",
              borderRadius: 12,
              gap: 10,
            }}
          >
            <Avatar uri={item.author.avatar} size={36} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1f2937" }}>
                  {item.author.displayName || item.author.username}
                </Text>
                <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                  {formatDistanceToNow(new Date(item.createdAt))}
                </Text>
              </View>
              <Text
                numberOfLines={4}
                style={{ fontSize: 14, color: "#4b5563", marginTop: 4, lineHeight: 20 }}
              >
                {item.content}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
