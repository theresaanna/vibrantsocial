import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { Sparklefall } from "@/components/sparklefall";
import { PostCard } from "@/components/post-card";
import { WallPostComposer } from "@/components/wall-post-composer";
import { WallPostList } from "@/components/wall-post-list";
import { LexicalRenderer } from "@/components/lexical-renderer";
import { PremiumBadge } from "@/components/premium-badge";
import { UserActionSheet } from "@/components/user-action-sheet";
import { getThemeStyles, hasCustomTheme, hexToRgba, resolveImageUrl } from "@/lib/user-theme";

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  backgroundUrl: string | null;
  tier: "free" | "premium";
  followersCount: number;
  followingCount: number;
  friendsCount: number;
  postsCount: number;
  isFollowing: boolean;
  isFriend: boolean;
  friendRequestStatus: "none" | "sent" | "received" | "accepted";
  profileFrameId: string | null;
  profileFontId: string | null;
  sparklefallEnabled: boolean;
  sparklefallPreset: string | null;
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
  profileContainerOpacity: number | null;
  profileBgImage: string | null;
}

interface TabFlags {
  hasSensitive: boolean;
  hasNsfw: boolean;
  hasGraphic: boolean;
  hasMarketplace: boolean;
  showWall: boolean;
  hasMedia: boolean;
}

type TabId = "posts" | "media" | "wall" | "sensitive" | "nsfw" | "graphic" | "marketplace";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("posts");
  const [showActionSheet, setShowActionSheet] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", username],
    queryFn: () => api.rpc<UserProfile>("getProfile", username),
  });

  const { data: tabFlags } = useQuery({
    queryKey: ["profileTabFlags", profile?.id],
    queryFn: () => api.rpc<TabFlags>("getProfileTabFlags", profile?.id),
    enabled: !!profile?.id,
  });

  const toggleFollow = useMutation({
    mutationFn: () =>
      api.rpc(profile?.isFollowing ? "unfollowUser" : "followUser", profile?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["userProfile", username] }),
  });

  if (isLoading || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  const isOwnProfile = user?.id === profile.id;
  const themed = hasCustomTheme(profile);
  const theme = getThemeStyles(profile);
  const bgColor = theme.backgroundColor;
  const textColor = theme.textColor;
  const secondaryColor = theme.secondaryColor;
  const linkColor = theme.linkColor;
  const containerColor = hexToRgba(theme.containerColor, theme.containerOpacity);

  // Build visible tabs
  const tabs: { id: TabId; label: string }[] = [{ id: "posts", label: "Posts" }];
  if (tabFlags?.hasMedia) tabs.push({ id: "media", label: "Media" });
  if (tabFlags?.showWall) tabs.push({ id: "wall", label: "Wall" });
  if (tabFlags?.hasSensitive) tabs.push({ id: "sensitive", label: "Sensitive" });
  if (tabFlags?.hasNsfw) tabs.push({ id: "nsfw", label: "NSFW" });
  if (tabFlags?.hasGraphic) tabs.push({ id: "graphic", label: "Graphic/Explicit" });
  if (tabFlags?.hasMarketplace) tabs.push({ id: "marketplace", label: "Marketplace" });

  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "posts";

  const headerProps = {
    profile,
    bgColor,
    textColor,
    secondaryColor,
    linkColor,
    containerColor,
    tabs,
    currentTab,
    onTabChange: setActiveTab,
    themed,
    isOwnProfile,
    toggleFollow,
    setShowActionSheet,
    router,
    username: username!,
    user,
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Background image */}
      {theme.bgImageUrl && (
        <Image
          source={{ uri: resolveImageUrl(theme.bgImageUrl) ?? undefined }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
        />
      )}

      {/* Sparklefall overlay */}
      {profile.sparklefallEnabled && (
        <Sparklefall presetName={profile.sparklefallPreset} />
      )}

      {currentTab === "wall" ? (
        <ScrollView style={{ flex: 1 }}>
          <UserProfileHeader {...headerProps} />
          {!isOwnProfile && user && profile.isFriend && (
            <WallPostComposer
              wallOwnerId={profile.id}
              wallOwnerName={profile.displayName || profile.username}
            />
          )}
          <WallPostList wallOwnerId={profile.id} />
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <UserProfilePostFeed
          profile={profile}
          tab={currentTab}
          linkColor={linkColor}
          secondaryColor={secondaryColor}
          headerProps={headerProps}
        />
      )}

      {/* User action sheet */}
      {!isOwnProfile && (
        <UserActionSheet
          visible={showActionSheet}
          onClose={() => setShowActionSheet(false)}
          userId={profile.id}
          username={profile.username}
        />
      )}
    </View>
  );
}

// ── User Profile Header ──────────────────────────────────────────

function UserProfileHeader({
  profile,
  bgColor,
  textColor,
  secondaryColor,
  linkColor,
  containerColor,
  tabs,
  currentTab,
  onTabChange,
  themed,
  isOwnProfile,
  toggleFollow,
  setShowActionSheet,
  router,
  username,
  user,
}: {
  profile: UserProfile;
  bgColor: string;
  textColor: string;
  secondaryColor: string;
  linkColor: string;
  containerColor: string;
  tabs: { id: TabId; label: string }[];
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  themed: boolean;
  isOwnProfile: boolean;
  toggleFollow: any;
  setShowActionSheet: (v: boolean) => void;
  router: any;
  username: string;
  user: any;
}) {
  return (
    <View>
      {profile.backgroundUrl && (
        <Image source={{ uri: profile.backgroundUrl }} style={{ width: "100%", height: 150 }} contentFit="cover" />
      )}

      <View style={{ alignItems: "center", marginTop: profile.backgroundUrl ? -40 : 20 }}>
        <View style={{ borderWidth: 3, borderColor: bgColor, borderRadius: 46 }}>
          <FramedAvatar uri={profile.avatar} size={80} frameId={profile.profileFrameId} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <StyledName
            fontId={profile.profileFontId}
            style={{ fontSize: 20, fontWeight: "700", color: textColor }}
          >
            {profile.displayName || profile.username}
          </StyledName>
          {profile.tier === "premium" && <PremiumBadge size="md" />}
        </View>
        <Text style={{ color: secondaryColor, fontSize: 14 }}>@{profile.username}</Text>
      </View>

      {/* Bio + Stats container */}
      <View style={{
        marginHorizontal: 12,
        marginTop: 12,
        backgroundColor: containerColor,
        borderRadius: 16,
        overflow: "hidden",
      }}>
        {profile.bio && (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
            <LexicalRenderer content={profile.bio} />
          </View>
        )}

        <View style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingVertical: 14,
          borderTopWidth: profile.bio ? 1 : 0,
          borderTopColor: secondaryColor + "22",
        }}>
          <TouchableOpacity onPress={() => router.push(`/(stack)/${username}/followers`)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>{profile.followersCount}</Text>
            <Text style={{ color: secondaryColor, fontSize: 12 }}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/(stack)/${username}/following`)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>{profile.followingCount}</Text>
            <Text style={{ color: secondaryColor, fontSize: 12 }}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/(stack)/${username}/friends`)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>{profile.friendsCount}</Text>
            <Text style={{ color: secondaryColor, fontSize: 12 }}>Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action buttons */}
      {!isOwnProfile && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, padding: 16 }}>
          <TouchableOpacity
            onPress={() => toggleFollow.mutate()}
            style={{
              backgroundColor: profile.isFollowing ? containerColor : "#c026d3",
              borderRadius: 20,
              paddingHorizontal: 24,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: profile.isFollowing ? textColor : "#fff", fontWeight: "600" }}>
              {profile.isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {/* navigate to chat */}}
            style={{
              backgroundColor: containerColor,
              borderRadius: 20,
              paddingHorizontal: 24,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontWeight: "600", color: textColor }}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowActionSheet(true)}
            style={{
              backgroundColor: containerColor,
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, color: secondaryColor }}>{"\u22EF"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: isOwnProfile ? 16 : 0 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === currentTab;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isActive
                  ? (themed ? textColor : "#c026d3")
                  : (themed ? secondaryColor + "26" : "#f4f4f5"),
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: isActive
                    ? (themed ? bgColor : "#fff")
                    : (themed ? textColor : "#71717a"),
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Profile Post Feed ────────────────────────────────────────────

function UserProfilePostFeed({
  profile,
  tab,
  linkColor,
  secondaryColor,
  headerProps,
}: {
  profile: UserProfile;
  tab: TabId;
  linkColor: string;
  secondaryColor: string;
  headerProps: any;
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["profilePosts", profile.id, tab],
    queryFn: async ({ pageParam }) => {
      return await api.rpc<{ items: any[]; hasMore: boolean; nextCursor: string | null }>(
        "getProfilePosts",
        profile.id,
        tab,
        pageParam
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextCursor ?? undefined;
    },
  });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  const renderItem = useCallback(
    ({ item }: { item: any }) => <PostCard post={item} />,
    []
  );

  return (
    <FlashList
      data={posts}
      renderItem={renderItem}
      estimatedItemSize={300}
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <>
          <UserProfileHeader {...headerProps} />
          <View style={{ height: 8 }} />
        </>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator color={linkColor} />
          </View>
        ) : (
          <View style={{ height: 32 }} />
        )
      }
      ListEmptyComponent={
        isLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={linkColor} />
          </View>
        ) : (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: secondaryColor, fontSize: 16, textAlign: "center" }}>
              No posts yet.
            </Text>
          </View>
        )
      }
    />
  );
}
