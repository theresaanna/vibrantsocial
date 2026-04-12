import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "@/lib/date";
import { useUserTheme, ScreenBackground } from "@/components/themed-view";

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
  actor: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  } | null;
  postId: string | null;
}

export default function NotificationsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <NotificationsContent />
    </View>
  );
}

function NotificationsContent() {
  const router = useRouter();
  const theme = useUserTheme();

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      api.rpc<{ notifications: Notification[]; nextCursor: string | null }>(
        "getRecentNotifications",
        pageParam
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.secondaryColor + "33" }}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: theme.textColor }}>Notifications</Text>
      </View>

      {isLoading ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color={theme.linkColor} />
        </View>
      ) : (
        <FlashList
          data={notifications}
          estimatedItemSize={72}
          keyExtractor={(item) => item.id}
          onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                if (item.postId) router.push(`/(stack)/post/${item.postId}`);
                else if (item.actor?.username) router.push(`/(stack)/${item.actor.username}`);
              }}
              style={{
                flexDirection: "row",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.secondaryColor + "1a",
                backgroundColor: item.read ? "transparent" : theme.linkColor + "11",
              }}
            >
              {item.actor && (
                <Image
                  source={{ uri: item.actor.avatar ?? undefined }}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.secondaryColor + "33" }}
                />
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, lineHeight: 20, color: theme.textColor }}>{item.message}</Text>
                <Text style={{ color: theme.secondaryColor, fontSize: 12, marginTop: 4 }}>
                  {formatDistanceToNow(new Date(item.createdAt))}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: theme.secondaryColor }}>No notifications</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
