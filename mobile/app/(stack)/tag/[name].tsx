import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { PostCard, type Post } from "@/components/post-card";

interface TagInfo {
  id: string;
  name: string;
  postCount: number;
  subscriberCount: number;
  subscribed: boolean;
}

interface TagPostsResponse {
  posts: Post[];
  hasMore: boolean;
  totalCount: number;
}

export default function TagScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const tagName = decodeURIComponent(name ?? "").toLowerCase();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();

  const { data: tagInfo, isLoading: infoLoading } = useQuery({
    queryKey: ["tagInfo", tagName],
    queryFn: () => api.rpc<TagInfo>("getTagInfo", tagName),
    enabled: !!tagName,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["tagPosts", tagName],
    queryFn: () => api.rpc<TagPostsResponse>("getPostsByTag", tagName, undefined, undefined, false),
    enabled: !!tagName,
  });

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sync initial data
  const posts = allPosts.length > 0 ? allPosts : postsData?.posts ?? [];
  const canLoadMore = allPosts.length > 0 ? hasMore : postsData?.hasMore ?? false;

  const toggleSubscription = useMutation({
    mutationFn: () => api.rpc("toggleTagSubscription", tagInfo?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tagInfo", tagName] });
      queryClient.invalidateQueries({ queryKey: ["tagSubscriptions"] });
    },
  });

  const loadMore = useCallback(async () => {
    if (loadingMore || !canLoadMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const lastPost = posts[posts.length - 1];
      const res = await api.rpc<TagPostsResponse>(
        "getPostsByTag",
        tagName,
        undefined,
        (lastPost as Post & { postTagId?: string }).postTagId ?? lastPost.id,
        false
      );
      setAllPosts([...posts, ...res.posts]);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, canLoadMore, posts, tagName]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} />,
    []
  );

  if (infoLoading || postsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" size="large" />
      </View>
    );
  }

  if (!tagInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#9ca3af", fontSize: 16 }}>Tag not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#1f2937" }}>
              #{tagInfo.name}
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>
              {tagInfo.postCount} {tagInfo.postCount === 1 ? "post" : "posts"}
              {" \u00b7 "}
              {tagInfo.subscriberCount} {tagInfo.subscriberCount === 1 ? "subscriber" : "subscribers"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleSubscription.mutate()}
            disabled={toggleSubscription.isPending}
            style={{
              backgroundColor: tagInfo.subscribed ? "#f3f4f6" : "#c026d3",
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 10,
              marginLeft: 12,
            }}
          >
            <Text
              style={{
                color: tagInfo.subscribed ? "#6b7280" : "#fff",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {tagInfo.subscribed ? "Subscribed" : "Subscribe"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Posts */}
      <FlashList
        data={posts}
        estimatedItemSize={300}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator color="#c026d3" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No posts with this tag yet</Text>
          </View>
        }
      />
    </View>
  );
}
