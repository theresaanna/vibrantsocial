import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import { NavBar } from "@/components/nav-bar";
import { ThemedView, useUserTheme } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";

type FeedTab = "feed" | "foryou" | "closefriends" | "lists";

const TAB_LABELS: Record<FeedTab, string> = {
  feed: "Feed",
  foryou: "For You",
  closefriends: "Close Friends",
  lists: "Lists",
};

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
  const [activeTab, setActiveTab] = useState<FeedTab>("feed");

  return (
    <>
      {/* Tab switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.secondaryColor + "33",
        }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {(Object.keys(TAB_LABELS) as FeedTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? theme.linkColor : "transparent",
            }}
          >
            <Text
              style={{
                fontWeight: activeTab === tab ? "600" : "400",
                color: activeTab === tab ? theme.linkColor : theme.secondaryColor,
                fontSize: 14,
              }}
            >
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === "feed" && <FriendsFeed />}
      {activeTab === "foryou" && <ForYouFeed />}
      {activeTab === "closefriends" && <CloseFriendsList />}
      {activeTab === "lists" && <ListsTab />}
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

// ── Close Friends ──────────────────────────────────────────────────

interface CloseFriend {
  id: string;
  friend: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
  };
}

function CloseFriendsList() {
  const theme = useUserTheme();

  const { data: friends, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["closeFriends"],
    queryFn: () => api.rpc<CloseFriend[]>("getCloseFriends"),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 }}>
        <ActivityIndicator size="large" color={theme.linkColor} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={theme.linkColor} />
      }
    >
      {!friends?.length ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <Text style={{ color: theme.secondaryColor, fontSize: 16, textAlign: "center" }}>
            No close friends yet. Add close friends from their profile page.
          </Text>
        </View>
      ) : (
        friends.map((cf) => {
          const user = cf.friend;
          const displayName = user.displayName || user.name || user.username || "Unknown";
          const avatarUri = user.avatar || user.image;
          return (
            <View
              key={cf.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.secondaryColor + "1a",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.secondaryColor + "33",
                  marginRight: 12,
                  overflow: "hidden",
                }}
              >
                {avatarUri && (
                  <View style={{ width: 44, height: 44 }}>
                    <Text style={{ fontSize: 24, textAlign: "center", lineHeight: 44 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", color: theme.textColor, fontSize: 16 }}>
                  {displayName}
                </Text>
                {user.username && (
                  <Text style={{ color: theme.secondaryColor, fontSize: 13 }}>
                    @{user.username}
                  </Text>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ── Lists ──────────────────────────────────────────────────────────

interface UserList {
  id: string;
  name: string;
  isPrivate: boolean;
  owner: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
  _count: {
    members: number;
    subscriptions: number;
  };
}

function ListsTab() {
  const theme = useUserTheme();

  const { data: lists, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["userLists"],
    queryFn: () => api.rpc<UserList[]>("fetchAllUserLists"),
  });

  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  if (selectedListId) {
    return (
      <ListFeed
        listId={selectedListId}
        onBack={() => setSelectedListId(null)}
        theme={theme}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 }}>
        <ActivityIndicator size="large" color={theme.linkColor} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={theme.linkColor} />
      }
    >
      {/* Create new list button */}
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.secondaryColor + "1a",
        }}
        onPress={() => {
          // TODO: navigate to create list screen
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.linkColor + "22",
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 22, color: theme.linkColor, fontWeight: "700" }}>+</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: "600", color: theme.linkColor }}>
          Create New List
        </Text>
      </TouchableOpacity>

      {!lists?.length ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <Text style={{ color: theme.secondaryColor, fontSize: 16, textAlign: "center" }}>
            No lists yet. Create one to organize the people you follow.
          </Text>
        </View>
      ) : (
        lists.map((list) => (
          <TouchableOpacity
            key={list.id}
            onPress={() => setSelectedListId(list.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.secondaryColor + "1a",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: theme.textColor, fontSize: 16 }}>
                {list.name}
              </Text>
              <Text style={{ color: theme.secondaryColor, fontSize: 13, marginTop: 2 }}>
                {list._count.members} member{list._count.members !== 1 ? "s" : ""}
                {list.isPrivate ? " \u00B7 Private" : ""}
              </Text>
            </View>
            <Text style={{ color: theme.secondaryColor, fontSize: 18 }}>{"\u203A"}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// ── List Feed (drill-in) ───────────────────────────────────────────

function ListFeed({ listId, onBack, theme }: { listId: string; onBack: () => void; theme: any }) {
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
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center" }}
      >
        <Text style={{ color: theme.linkColor, fontSize: 16 }}>{"\u2039"} Back to Lists</Text>
      </TouchableOpacity>
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
    </View>
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
