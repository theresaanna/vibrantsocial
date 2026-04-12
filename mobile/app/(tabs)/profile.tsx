import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { WallPostList } from "@/components/wall-post-list";
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

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => api.rpc<ProfileData>("getProfile", user?.username),
    enabled: !!user,
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
  const containerColor = hexToRgba(theme.containerColor, theme.containerOpacity);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Background image — uses theme size/position/repeat settings */}
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

      <ScrollView>
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
            <FramedAvatar
              uri={profile.avatar}
              size={80}
              frameId={profile.profileFrameId}
            />
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

        {/* Bio */}
        {profile.bio && (
          <Text style={{ padding: 16, textAlign: "center", color: secondaryColor, lineHeight: 20 }}>
            {profile.bio}
          </Text>
        )}

        {/* Stats */}
        <View style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingVertical: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: themed ? containerColor : "#e5e7eb",
          marginHorizontal: 16,
        }}>
          <StatItem label="Posts" count={profile.postsCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Followers" count={profile.followersCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Following" count={profile.followingCount} textColor={textColor} secondaryColor={secondaryColor} />
          <StatItem label="Friends" count={profile.friendsCount} textColor={textColor} secondaryColor={secondaryColor} />
        </View>

        {/* Wall Posts Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>Wall Posts</Text>
        </View>
        <WallPostList wallOwnerId={profile.id} />

        {/* Menu items */}
        <View style={{ padding: 16, gap: 4 }}>
          <MenuItem
            label="Edit Theme"
            onPress={() => router.push("/(stack)/theme")}
            accent
          />
          <MenuItem
            label="Customize Profile"
            onPress={() => router.push("/(stack)/settings/customize-profile")}
            accent
          />
          <MenuItem label="Edit Profile" onPress={() => router.push("/(stack)/settings")} />
          <MenuItem label="Bookmarks" onPress={() => router.push("/(stack)/bookmarks")} />
          <MenuItem label="Friend Requests" onPress={() => router.push("/(stack)/friend-requests")} />
          <MenuItem label="Settings" onPress={() => router.push("/(stack)/settings")} />
          <MenuItem label="Log out" onPress={logout} destructive />
        </View>
      </ScrollView>
    </View>
  );
}

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
