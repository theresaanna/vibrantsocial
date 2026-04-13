import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { PostCard } from "@/components/post-card";
import { WallPostList } from "@/components/wall-post-list";
import { WallPostComposer } from "@/components/wall-post-composer";
import { LexicalRenderer } from "@/components/lexical-renderer";
import { getThemeStyles, hasCustomTheme, hexToRgba, resolveImageUrl } from "@/lib/user-theme";

interface ProfileData {
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

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("posts");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => api.rpc<ProfileData>("getProfile", user?.username),
    enabled: !!user,
  });

  const { data: tabFlags } = useQuery({
    queryKey: ["profileTabFlags", profile?.id],
    queryFn: () => api.rpc<TabFlags>("getProfileTabFlags", profile?.id),
    enabled: !!profile?.id,
  });

  if (isLoading || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

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

  // Reset to posts if the active tab no longer exists
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "posts";

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Background image */}
      {theme.bgImageUrl && (
        <Image
          source={{ uri: resolveImageUrl(theme.bgImageUrl) ?? undefined }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit={
            theme.bgSize === "contain" ? "contain"
              : theme.bgSize === "100% 100%" ? "fill"
              : theme.bgSize === "auto" ? "none"
              : theme.bgRepeat === "repeat" || theme.bgRepeat === "repeat-x" || theme.bgRepeat === "repeat-y" ? "repeat"
              : "cover"
          }
          contentPosition={theme.bgPosition ?? "center"}
        />
      )}

      {/* Profile header as FlashList header, or ScrollView for wall tab */}
      {currentTab === "wall" ? (
        <ScrollView style={{ flex: 1 }}>
          <ProfileHeader
            profile={profile}
            bgColor={bgColor}
            textColor={textColor}
            secondaryColor={secondaryColor}
            linkColor={linkColor}
            containerColor={containerColor}
            tabs={tabs}
            currentTab={currentTab}
            onTabChange={setActiveTab}
            themed={themed}
          />
          <WallPostList wallOwnerId={profile.id} />
          <MenuItems router={router} logout={logout} />
        </ScrollView>
      ) : (
        <ProfilePostFeed
          profile={profile}
          tab={currentTab}
          bgColor={bgColor}
          textColor={textColor}
          secondaryColor={secondaryColor}
          linkColor={linkColor}
          containerColor={containerColor}
          tabs={tabs}
          currentTab={currentTab}
          onTabChange={setActiveTab}
          themed={themed}
          router={router}
          logout={logout}
        />
      )}
    </View>
  );
}

// ── Profile Header ───────────────────────────────────────────────

function ProfileHeader({
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
}: {
  profile: ProfileData;
  bgColor: string;
  textColor: string;
  secondaryColor: string;
  linkColor: string;
  containerColor: string;
  tabs: { id: TabId; label: string }[];
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  themed: boolean;
}) {
  return (
    <View>
      {/* Background banner */}
      {profile.backgroundUrl && (
        <Image
          source={{ uri: profile.backgroundUrl }}
          style={{ width: "100%", height: 150 }}
          contentFit="cover"
        />
      )}

      {/* Avatar + name */}
      <View style={{ alignItems: "center", marginTop: profile.backgroundUrl ? -40 : 20 }}>
        <View style={{ borderWidth: 3, borderColor: bgColor, borderRadius: 46 }}>
          <FramedAvatar uri={profile.avatar} size={80} frameId={profile.profileFrameId} />
        </View>
        <StyledName
          fontId={profile.profileFontId}
          style={{ fontSize: 20, fontWeight: "700", marginTop: 8, color: textColor }}
        >
          {profile.displayName || profile.username}
        </StyledName>
        <Text style={{ color: secondaryColor, fontSize: 14 }}>@{profile.username}</Text>
        {profile.tier === "premium" && (
          <View style={{ backgroundColor: "#c026d3", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, marginTop: 4 }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>PREMIUM</Text>
          </View>
        )}
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
          <StatItem label="Posts" count={profile.postsCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Followers" count={profile.followersCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Following" count={profile.followingCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Friends" count={profile.friendsCount} textColor={textColor} secondaryColor={secondaryColor} />
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16 }}
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

// ── Profile Post Feed (paginated FlashList) ──────────────────────

function ProfilePostFeed({
  profile,
  tab,
  bgColor,
  textColor,
  secondaryColor,
  linkColor,
  containerColor,
  tabs,
  currentTab,
  onTabChange,
  themed,
  router,
  logout,
}: {
  profile: ProfileData;
  tab: TabId;
  bgColor: string;
  textColor: string;
  secondaryColor: string;
  linkColor: string;
  containerColor: string;
  tabs: { id: TabId; label: string }[];
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  themed: boolean;
  router: any;
  logout: () => void;
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

  const header = (
    <>
      <ProfileHeader
        profile={profile}
        bgColor={bgColor}
        textColor={textColor}
        secondaryColor={secondaryColor}
        linkColor={linkColor}
        containerColor={containerColor}
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={onTabChange}
        themed={themed}
      />
      <View style={{ height: 8 }} />
    </>
  );

  const footer = (
    <>
      {isFetchingNextPage && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color={linkColor} />
        </View>
      )}
      <MenuItems router={router} logout={logout} />
    </>
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
      ListHeaderComponent={header}
      ListFooterComponent={footer}
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

// ── Menu Items ───────────────────────────────────────────────────

function MenuItems({ router, logout }: { router: any; logout: () => void }) {
  return (
    <View style={{ padding: 16, gap: 4 }}>
      <MenuItem label="Edit Theme" onPress={() => router.push("/(stack)/theme")} accent />
      <MenuItem label="Customize Profile" onPress={() => router.push("/(stack)/settings/customize-profile")} accent />
      <MenuItem label="Edit Profile" onPress={() => router.push("/(stack)/settings")} />
      <MenuItem label="Bookmarks" onPress={() => router.push("/(stack)/bookmarks")} />
      <MenuItem label="Friend Requests" onPress={() => router.push("/(stack)/friend-requests")} />
      <MenuItem label="Settings" onPress={() => router.push("/(stack)/settings")} />
      <MenuItem label="Log out" onPress={logout} destructive />
    </View>
  );
}

// ── Shared sub-components ────────────────────────────────────────

function StatItem({
  label,
  count,
  textColor = "#1f2937",
  secondaryColor = "#9ca3af",
}: {
  label: string;
  count: number;
  textColor?: string;
  secondaryColor?: string;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>{count}</Text>
      <Text style={{ color: secondaryColor, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  destructive,
  accent,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: accent ? "#fdf4ff" : "#f9fafb",
      }}
    >
      <Text
        style={{
          fontSize: 16,
          color: destructive ? "#ef4444" : accent ? "#c026d3" : "#1f2937",
          fontWeight: accent ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
