import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { PostCard } from "@/components/post-card";
import { UserListItem } from "@/components/user-list-item";

type CommunityTab = "newcomers" | "discussions" | "media";

interface NewcomerUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  bio: string | null;
  joinedAt: string;
}

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

interface MediaItem {
  id: string;
  url: string;
  type: string;
  postId: string;
}

export default function CommunitiesScreen() {
  const [activeTab, setActiveTab] = useState<CommunityTab>("newcomers");
  const router = useRouter();

  const { data: newcomersData, isLoading: newcomersLoading } = useQuery({
    queryKey: ["communities", "newcomers"],
    queryFn: () => api.rpc<{ users: NewcomerUser[] }>("fetchNewcomers"),
    enabled: activeTab === "newcomers",
  });

  const { data: discussionsData, isLoading: discussionsLoading } = useQuery({
    queryKey: ["communities", "discussions"],
    queryFn: () => api.rpc<{ posts: Post[] }>("fetchTopDiscussedPosts"),
    enabled: activeTab === "discussions",
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ["communities", "media"],
    queryFn: () => api.rpc<{ media: MediaItem[] }>("fetchCommunitiesMediaPage"),
    enabled: activeTab === "media",
  });

  const isLoading =
    (activeTab === "newcomers" && newcomersLoading) ||
    (activeTab === "discussions" && discussionsLoading) ||
    (activeTab === "media" && mediaLoading);

  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} />,
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Tab switcher */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
          paddingHorizontal: 16,
        }}
      >
        {(["newcomers", "discussions", "media"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? "#c026d3" : "transparent",
            }}
          >
            <Text
              style={{
                fontWeight: activeTab === tab ? "600" : "400",
                color: activeTab === tab ? "#c026d3" : "#6b7280",
                textTransform: "capitalize",
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <ActivityIndicator color="#c026d3" />
        </View>
      ) : activeTab === "newcomers" ? (
        <FlashList
          data={newcomersData?.users ?? []}
          estimatedItemSize={72}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserListItem user={item} />}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>No newcomers right now</Text>
            </View>
          }
        />
      ) : activeTab === "discussions" ? (
        <FlashList
          data={discussionsData?.posts ?? []}
          estimatedItemSize={300}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>No discussions yet</Text>
            </View>
          }
        />
      ) : (
        <FlashList
          data={mediaData?.media ?? []}
          numColumns={3}
          estimatedItemSize={130}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(stack)/post/${item.postId}`)}
              activeOpacity={0.7}
              style={{ flex: 1 / 3, aspectRatio: 1, padding: 1 }}
            >
              <Image
                source={{ uri: item.url }}
                style={{ flex: 1, backgroundColor: "#f3f4f6" }}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: "#9ca3af", fontSize: 15 }}>No media yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
