import { View, Text, ActivityIndicator, RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import { useCallback } from "react";

interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    profileFrameId: string | null;
  };
  _count: {
    comments: number;
    likes: number;
    reposts: number;
  };
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  media: { url: string; type: string }[];
}

export default function BookmarksScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api.rpc<{ posts: Post[] }>("getBookmarks"),
  });

  const posts = data?.posts ?? [];

  const renderItem = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} />,
    []
  );

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
        data={posts}
        estimatedItemSize={300}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#c026d3"
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No bookmarks yet</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
              Save posts to revisit them later
            </Text>
          </View>
        }
      />
    </View>
  );
}
