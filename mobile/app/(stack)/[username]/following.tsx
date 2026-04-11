import { View, Text, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UserListItem } from "@/components/user-list-item";

interface FollowingUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
}

export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["following", username],
    queryFn: () => api.rpc<{ users: FollowingUser[] }>("getFollowing", username),
  });

  const users = data?.users ?? [];

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
        data={users}
        estimatedItemSize={72}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <UserListItem user={item} />}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>Not following anyone yet</Text>
          </View>
        }
      />
    </View>
  );
}
