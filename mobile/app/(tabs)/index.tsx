import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import { StatusBar } from "@/components/status-bar";
import { NavBar } from "@/components/nav-bar";
import { ThemedView, useUserTheme } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";

type FeedTab = "home" | "friends" | "media";

export default function FeedScreen() {
  const { data: myTheme } = useMyTheme();

  return (
    <ThemedView themeData={myTheme}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <NavBar />
        <FeedContent />
        {myTheme?.sparklefallEnabled && myTheme.sparklefallPreset && (
          <Sparklefall preset={myTheme.sparklefallPreset} />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function FeedContent() {
  const theme = useUserTheme();
  const [activeTab, setActiveTab] = useState<FeedTab>("home");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["feed", activeTab],
    queryFn: async ({ pageParam }) => {
      const result = await api.rpc<{
        items: Array<{ type: "post" | "repost"; data: any; date: string }>;
        hasMore: boolean;
      }>("fetchFeedPage", pageParam);
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1]?.date;
    },
  });

  const feedItems = data?.pages.flatMap((page) =>
    page.items
      .filter((item) => item.data != null)
      .map((item) => {
        if (item.type === "repost" && item.data.post) {
          return {
            ...item.data.post,
            _repost: {
              id: item.data.id,
              user: item.data.user,
              content: item.data.content,
              createdAt: item.data.createdAt,
            },
          };
        }
        return item.data;
      })
      .filter((post) => post.author != null)
  ) ?? [];

  const renderItem = useCallback(
    ({ item }: { item: any }) => <PostCard post={item} />,
    []
  );

  return (
    <>
      {/* Tab switcher */}
      <View style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: theme.secondaryColor + "33",
        paddingHorizontal: 16,
      }}>
        {(["home", "friends", "media"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? theme.linkColor : "transparent",
            }}
          >
            <Text
              style={{
                fontWeight: activeTab === tab ? "600" : "400",
                color: activeTab === tab ? theme.linkColor : theme.secondaryColor,
                textTransform: "capitalize",
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed list */}
      <FlashList
        data={feedItems}
        renderItem={renderItem}
        estimatedItemSize={300}
        keyExtractor={(item) => item._repost ? `repost-${item._repost.id}` : item.id}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={theme.linkColor} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: theme.secondaryColor, fontSize: 16 }}>No posts yet</Text>
            </View>
          )
        }
      />
    </>
  );
}
