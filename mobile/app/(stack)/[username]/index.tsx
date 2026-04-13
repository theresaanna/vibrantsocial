import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FramedAvatar } from "@/components/framed-avatar";
import { StyledName } from "@/components/styled-name";
import { Sparklefall } from "@/components/sparklefall";
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

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", username],
    queryFn: () => api.rpc<UserProfile>("getProfile", username),
  });

  const [showActionSheet, setShowActionSheet] = useState(false);

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

      <ScrollView style={{ flex: 1 }}>
        {profile.backgroundUrl && (
          <Image source={{ uri: profile.backgroundUrl }} style={{ width: "100%", height: 150 }} contentFit="cover" />
        )}

        <View style={{ alignItems: "center", marginTop: profile.backgroundUrl ? -40 : 20 }}>
          <View style={{ borderWidth: 3, borderColor: bgColor, borderRadius: 46 }}>
            <FramedAvatar
              uri={profile.avatar}
              size={80}
              frameId={profile.profileFrameId}
            />
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
              onPress={() => {/* navigate to chat with user */}}
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
        {/* Wall Posts */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>Wall</Text>
        </View>

        {/* Wall post composer - only for other user profiles when they are friends */}
        {!isOwnProfile && user && profile.isFriend && (
          <WallPostComposer
            wallOwnerId={profile.id}
            wallOwnerName={profile.displayName || profile.username}
          />
        )}

        <WallPostList wallOwnerId={profile.id} />

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* User action sheet (three-dot menu) */}
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
