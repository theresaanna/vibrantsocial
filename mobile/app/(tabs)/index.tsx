import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import { NavBar } from "@/components/nav-bar";
import { ThemedView, useUserTheme } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";

// ── Types ─────────────────────────────────────────────────────────

interface OwnedList {
  id: string;
  name: string;
  _count: { members: number };
}

type FeedTabId = "feed" | "foryou" | "closefriends" | string; // string = list ID

// ── Screen ────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { data: myTheme } = useMyTheme();

  return (
    <ThemedView themeData={myTheme}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <NavBar />
        <FeedContent />
        {myTheme?.sparklefallEnabled && (
          <Sparklefall
            presetName={myTheme.sparklefallPreset ?? "default"}
            sparkles={myTheme.sparklefallSparkles ? myTheme.sparklefallSparkles.split(",") : undefined}
            interval={myTheme.sparklefallInterval ?? undefined}
            wind={myTheme.sparklefallWind ?? undefined}
            maxSparkles={myTheme.sparklefallMaxSparkles ?? undefined}
            minSize={myTheme.sparklefallMinSize ?? undefined}
            maxSize={myTheme.sparklefallMaxSize ?? undefined}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function FeedContent() {
  const theme = useUserTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FeedTabId>("feed");

  // Fetch user's owned + subscribed lists for tabs
  const { data: ownedLists } = useQuery({
    queryKey: ["userLists"],
    queryFn: () => api.rpc<OwnedList[]>("getUserLists"),
  });

  // Build tab list: Feed, For You, Close Friends, then each list, then +
  const fixedTabs: { id: FeedTabId; label: string }[] = [
    { id: "feed", label: "Feed" },
    { id: "foryou", label: "For You" },
    { id: "closefriends", label: "Close Friends" },
  ];

  const listTabs: { id: string; label: string }[] = [
    ...(ownedLists ?? []).map((l) => ({ id: l.id, label: l.name })),
  ];

  const allTabs = [...fixedTabs, ...listTabs];

  // If the active tab was a list that no longer exists, reset to feed
  const isActiveValid = allTabs.some((t) => t.id === activeTab);
  const currentTab = isActiveValid ? activeTab : "feed";

  const isListTab = currentTab !== "feed" && currentTab !== "foryou" && currentTab !== "closefriends";

  return (
    <>
      {/* Tab switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.secondaryColor + "33",
          flexGrow: 0,
        }}
        contentContainerStyle={{ paddingHorizontal: 8, alignItems: "center" }}
      >
        {allTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 2,
              borderBottomColor: currentTab === tab.id ? theme.linkColor : "transparent",
            }}
          >
            <Text
              style={{
                fontWeight: currentTab === tab.id ? "600" : "400",
                color: currentTab === tab.id ? theme.linkColor : theme.secondaryColor,
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* + button to manage lists */}
        <TouchableOpacity
          onPress={() => router.push("/(stack)/lists")}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.secondaryColor,
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tab content */}
      {currentTab === "feed" && <FriendsFeed />}
      {currentTab === "foryou" && <ForYouFeed />}
      {currentTab === "closefriends" && <CloseFriendsFeed />}
      {isListTab && <ListFeed listId={currentTab} />}
    </>
  );
}

// ── Feed (Friends) ─────────────────────────────────────────────────

function FriendsFeed() {
  const theme = useUserTheme();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["feed", "friends"],
    queryFn: async ({ pageParam }) => {
      return await api.rpc<{
        items: Array<{ type: "post" | "repost"; data: any; date: string }>;
        hasMore: boolean;
      }>("fetchFeedPage", pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1]?.date;
    },
  });

  const feedItems = parseFeedItems(data);

  return (
    <FeedList
      data={feedItems}
      isLoading={isLoading}
      isRefetching={isRefetching}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onRefresh={refetch}
      onEndReached={fetchNextPage}
      emptyText="No posts from friends yet. Follow people to see their posts here!"
      theme={theme}
    />
  );
}

// ── For You ────────────────────────────────────────────────────────

function ForYouFeed() {
  const theme = useUserTheme();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["feed", "forYou"],
    queryFn: async ({ pageParam }) => {
      return await api.rpc<{
        items: Array<{ type: "post" | "repost"; data: any; date: string }>;
        hasMore: boolean;
      }>("fetchForYouPage", pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1]?.date;
    },
  });

  const feedItems = parseFeedItems(data);

  return (
    <FeedList
      data={feedItems}
      isLoading={isLoading}
      isRefetching={isRefetching}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onRefresh={refetch}
      onEndReached={fetchNextPage}
      emptyText="Nothing in For You right now. Check back later!"
      theme={theme}
    />
  );
}

// ── Close Friends Feed ─────────────────────────────────────────────

function CloseFriendsFeed() {
  const theme = useUserTheme();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["feed", "closeFriends"],
    queryFn: async ({ pageParam }) => {
      return await api.rpc<{
        items: Array<{ type: "post" | "repost"; data: any; date: string }>;
        hasMore: boolean;
      }>("fetchCloseFriendsFeedPage", pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1]?.date;
    },
  });

  const feedItems = parseFeedItems(data);

  return (
    <FeedList
      data={feedItems}
      isLoading={isLoading}
      isRefetching={isRefetching}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onRefresh={refetch}
      onEndReached={fetchNextPage}
      emptyText="No close friends posts yet."
      theme={theme}
    />
  );
}

// ── List Feed ─────────────────────────────────────────────────────

function ListFeed({ listId }: { listId: string }) {
  const theme = useUserTheme();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["listFeed", listId],
    queryFn: async ({ pageParam }) => {
      return await api.rpc<{
        items: Array<{ type: "post" | "repost"; data: any; date: string }>;
        hasMore: boolean;
      }>("fetchListFeedPage", listId, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.items.length) return undefined;
      return lastPage.items[lastPage.items.length - 1]?.date;
    },
  });

  const feedItems = parseFeedItems(data);

  return (
    <FeedList
      data={feedItems}
      isLoading={isLoading}
      isRefetching={isRefetching}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onRefresh={refetch}
      onEndReached={fetchNextPage}
      emptyText="No posts in this list yet."
      theme={theme}
    />
  );
}

// ── Shared components ──────────────────────────────────────────────

function parseFeedItems(data: any) {
  return data?.pages.flatMap((page: any) =>
    page.items
      .filter((item: any) => item.data != null)
      .map((item: any) => {
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
      .filter((post: any) => post.author != null)
  ) ?? [];
}

function FeedList({
  data,
  isLoading,
  isRefetching,
  hasNextPage,
  isFetchingNextPage,
  onRefresh,
  onEndReached,
  emptyText,
  theme,
}: {
  data: any[];
  isLoading: boolean;
  isRefetching: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  emptyText: string;
  theme: any;
}) {
  const renderItem = useCallback(
    ({ item }: { item: any }) => <PostCard post={item} />,
    []
  );

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      estimatedItemSize={300}
      keyExtractor={(item) => item._repost ? `repost-${item._repost.id}` : item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) onEndReached();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.linkColor} />
      }
      ListEmptyComponent={
        isLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.linkColor} />
          </View>
        ) : (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: theme.secondaryColor, fontSize: 16, textAlign: "center" }}>
              {emptyText}
            </Text>
          </View>
        )
      }
    />
  );
}
