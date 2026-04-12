import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Switch,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";
import { useUserTheme, ScreenBackground } from "@/components/themed-view";
import { hexToRgba } from "@/lib/user-theme";
import { useAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────

interface MemberUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
}

interface MemberEntry {
  id: string;
  userId: string;
  user: MemberUser;
}

interface CollaboratorEntry {
  id: string;
  userId: string;
  user: MemberUser;
}

interface ListOwner {
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  image: string | null;
  profileFrameId: string | null;
}

interface ListInfo {
  id: string;
  name: string;
  ownerId: string;
  isPrivate: boolean;
  owner: ListOwner;
}

interface ListDetailResponse {
  list: ListInfo;
  members: MemberEntry[];
  isCollaborator: boolean;
}

interface SearchResult extends MemberUser {
  isInList?: boolean;
  isCollaborator?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

function displayName(user: MemberUser) {
  return user.displayName || user.name || user.username || "Unknown";
}

function avatarUri(user: MemberUser) {
  return user.avatar || user.image || undefined;
}

// ── Screen ────────────────────────────────────────────────────────

export default function ListDetailScreen() {
  const { id: listId } = useLocalSearchParams<{ id: string }>();
  const theme = useUserTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const containerBg = hexToRgba(theme.containerColor, theme.containerOpacity);

  // ── Data fetching ─────────────────────────────────────────────
  const {
    data: listResponse,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["listMembers", listId],
    queryFn: () => api.rpc<ListDetailResponse>("getListMembers", listId),
    enabled: !!listId,
  });

  const listData = listResponse?.list;
  const members = listResponse?.members ?? [];
  const isCollab = listResponse?.isCollaborator ?? false;

  const { data: collaborators, refetch: refetchCollabs } = useQuery({
    queryKey: ["listCollaborators", listId],
    queryFn: () =>
      api.rpc<CollaboratorEntry[]>("getListCollaborators", listId),
    enabled: !!listId,
  });

  const isOwner = listData?.ownerId === currentUser?.id;
  const canManageMembers = isOwner || isCollab;

  // ── Subscription ─────────────────────────────────────────────
  const { data: isSubscribed, refetch: refetchSub } = useQuery({
    queryKey: ["listSubscription", listId],
    queryFn: () => api.rpc<boolean>("isSubscribedToList", listId),
    enabled: !!listId && !isOwner,
  });

  const subscribeMutation = useMutation({
    mutationFn: () =>
      api.rpc<{ success: boolean; message: string; isSubscribed: boolean }>("toggleListSubscription", listId),
    onSuccess: (result) => {
      if (result.success) {
        refetchSub();
        queryClient.invalidateQueries({ queryKey: ["userLists"] });
        queryClient.invalidateQueries({ queryKey: ["subscribedLists"] });
        Toast.show({ type: "success", text1: result.message });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  const handleShare = async () => {
    if (!listData) return;
    try {
      await Share.share({
        message: `Check out this list on VibrantSocial: ${listData.name}`,
        url: `https://www.vibrantsocial.app/lists/${listData.id}`,
      });
    } catch {
      // User cancelled
    }
  };

  // ── Rename ────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      api.rpc<{ success: boolean; message: string }>("renameList", listId, name),
    onSuccess: (result) => {
      if (result.success) {
        setIsRenaming(false);
        queryClient.invalidateQueries({ queryKey: ["listMembers", listId] });
        queryClient.invalidateQueries({ queryKey: ["userLists"] });
        Toast.show({ type: "success", text1: "List renamed" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  // ── Privacy toggle ────────────────────────────────────────────
  const [localPrivate, setLocalPrivate] = useState<boolean | null>(null);
  const privacyMutation = useMutation({
    mutationFn: () =>
      api.rpc<{ success: boolean; message: string; isPrivate: boolean }>("toggleListPrivacy", listId),
    onSuccess: (result) => {
      if (result.success) {
        setLocalPrivate(result.isPrivate);
        queryClient.invalidateQueries({ queryKey: ["listMembers", listId] });
        Toast.show({ type: "success", text1: result.message });
      }
    },
  });

  const isPrivate = localPrivate ?? listData?.isPrivate ?? false;

  // ── Member search ─────────────────────────────────────────────
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<SearchResult[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const memberDebounce = useRef<ReturnType<typeof setTimeout>>(null);

  const handleMemberSearch = useCallback(
    (value: string) => {
      setMemberQuery(value);
      if (memberDebounce.current) clearTimeout(memberDebounce.current);
      if (value.trim().length < 2) {
        setMemberResults([]);
        setIsSearchingMembers(false);
        return;
      }
      setIsSearchingMembers(true);
      memberDebounce.current = setTimeout(async () => {
        try {
          const result = await api.rpc<{ users: SearchResult[] }>("searchUsersForList", listId, value);
          setMemberResults(result.users ?? []);
        } catch {
          setMemberResults([]);
        }
        setIsSearchingMembers(false);
      }, 300);
    },
    [listId]
  );

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.rpc<{ success: boolean; message: string }>("addMemberToList", listId, userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["listMembers", listId] });
        // Re-search to update isInList state
        if (memberQuery.trim().length >= 2) handleMemberSearch(memberQuery);
        Toast.show({ type: "success", text1: "Member added" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.rpc<{ success: boolean; message: string }>("removeMemberFromList", listId, userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["listMembers", listId] });
        if (memberQuery.trim().length >= 2) handleMemberSearch(memberQuery);
        Toast.show({ type: "success", text1: "Member removed" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  // ── Collaborator search ───────────────────────────────────────
  const [collabQuery, setCollabQuery] = useState("");
  const [collabResults, setCollabResults] = useState<SearchResult[]>([]);
  const [isSearchingCollabs, setIsSearchingCollabs] = useState(false);
  const collabDebounce = useRef<ReturnType<typeof setTimeout>>(null);

  const handleCollabSearch = useCallback(
    (value: string) => {
      setCollabQuery(value);
      if (collabDebounce.current) clearTimeout(collabDebounce.current);
      if (value.trim().length < 2) {
        setCollabResults([]);
        setIsSearchingCollabs(false);
        return;
      }
      setIsSearchingCollabs(true);
      collabDebounce.current = setTimeout(async () => {
        try {
          const result = await api.rpc<{ users: SearchResult[] }>("searchUsersForCollaborator", listId, value);
          setCollabResults(result.users ?? []);
        } catch {
          setCollabResults([]);
        }
        setIsSearchingCollabs(false);
      }, 300);
    },
    [listId]
  );

  const addCollabMutation = useMutation({
    mutationFn: (userId: string) =>
      api.rpc<{ success: boolean; message: string }>("addCollaboratorToList", listId, userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["listCollaborators", listId] });
        if (collabQuery.trim().length >= 2) handleCollabSearch(collabQuery);
        Toast.show({ type: "success", text1: "Collaborator added" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  const removeCollabMutation = useMutation({
    mutationFn: (userId: string) =>
      api.rpc<{ success: boolean; message: string }>("removeCollaboratorFromList", listId, userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["listCollaborators", listId] });
        if (collabQuery.trim().length >= 2) handleCollabSearch(collabQuery);
        Toast.show({ type: "success", text1: "Collaborator removed" });
      } else {
        Toast.show({ type: "error", text1: result.message });
      }
    },
  });

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.linkColor} />
        </View>
      </View>
    );
  }

  if (!listData) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenBackground />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ color: theme.secondaryColor, fontSize: 16 }}>List not found</Text>
        </View>
      </View>
    );
  }

  const ownerName = listData.owner.displayName || listData.owner.name || listData.owner.username || "Unknown";
  const ownerAvatar = listData.owner.avatar || listData.owner.image;

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { refetch(); refetchCollabs(); refetchSub(); }}
            tintColor={theme.linkColor}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* List icon */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#7c3aed",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{"\u2630"}</Text>
          </View>

          {/* Member count + owner */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: theme.secondaryColor }}>
              {members.length} {members.length === 1 ? "member" : "members"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              {ownerAvatar ? (
                <Image
                  source={{ uri: ownerAvatar }}
                  style={{ width: 16, height: 16, borderRadius: 8 }}
                />
              ) : null}
              <TouchableOpacity onPress={() => listData.owner.username && router.push(`/(stack)/${listData.owner.username}`)}>
                <Text style={{ fontSize: 12, color: theme.secondaryColor }}>
                  by {ownerName}
                </Text>
              </TouchableOpacity>
              {listData.isPrivate && (
                <View style={{
                  backgroundColor: theme.secondaryColor + "33",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  marginLeft: 4,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: theme.secondaryColor }}>
                    Private
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {/* Share */}
            <TouchableOpacity
              onPress={handleShare}
              style={{
                borderWidth: 1,
                borderColor: theme.secondaryColor + "44",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: theme.secondaryColor }}>{"<"}</Text>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.secondaryColor }}>Share</Text>
            </TouchableOpacity>

            {/* Subscribe (non-owners only) */}
            {!isOwner && (
              <TouchableOpacity
                onPress={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                style={{
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  ...(isSubscribed
                    ? { backgroundColor: theme.linkColor }
                    : { borderWidth: 2, borderColor: theme.linkColor }),
                  opacity: subscribeMutation.isPending ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isSubscribed ? "#fff" : theme.linkColor,
                  }}
                >
                  {subscribeMutation.isPending ? "..." : isSubscribed ? "Subscribed" : "Subscribe"}
                </Text>
              </TouchableOpacity>
            )}

            {/* View Feed */}
            <TouchableOpacity
              onPress={() => {
                router.back();
              }}
              style={{
                backgroundColor: "#7c3aed",
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>View Feed</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── List name — owner can rename ────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {isOwner && isRenaming ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                autoFocus
                maxLength={50}
                style={{
                  flex: 1,
                  backgroundColor: containerBg,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.textColor,
                }}
              />
              <TouchableOpacity
                onPress={() => renameMutation.mutate(renameValue)}
                disabled={renameMutation.isPending}
                style={{
                  backgroundColor: theme.linkColor,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsRenaming(false)}>
                <Text style={{ color: theme.secondaryColor, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: theme.textColor, flex: 1 }}>
                {listData.name}
              </Text>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => {
                    setRenameValue(listData.name);
                    setIsRenaming(true);
                  }}
                >
                  <Text style={{ fontSize: 16, color: theme.secondaryColor }}>✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Privacy toggle — owner only */}
        {isOwner && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              backgroundColor: containerBg,
              borderRadius: 14,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textColor }}>
                Private list
              </Text>
              <Text style={{ fontSize: 12, color: theme.secondaryColor, marginTop: 2 }}>
                Only members and collaborators can view this list
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={() => privacyMutation.mutate()}
              disabled={privacyMutation.isPending}
              trackColor={{ true: theme.linkColor, false: theme.secondaryColor + "44" }}
            />
          </View>
        )}

        {/* Add members — owner or collaborator */}
        {canManageMembers && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader text="Add members" theme={theme} />
            <TextInput
              value={memberQuery}
              onChangeText={handleMemberSearch}
              placeholder="Search users to add..."
              placeholderTextColor={theme.secondaryColor}
              style={{
                backgroundColor: containerBg,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: theme.textColor,
                marginBottom: 8,
              }}
            />
            {isSearchingMembers && (
              <Text style={{ color: theme.secondaryColor, fontSize: 13, marginBottom: 8 }}>
                Searching...
              </Text>
            )}
            {memberResults.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                theme={theme}
                containerBg={containerBg}
                action={
                  user.isInList ? (
                    <ActionButton
                      label="Remove"
                      color="#ef4444"
                      theme={theme}
                      loading={removeMemberMutation.isPending}
                      onPress={() => removeMemberMutation.mutate(user.id)}
                    />
                  ) : (
                    <ActionButton
                      label="Add"
                      filled
                      theme={theme}
                      loading={addMemberMutation.isPending}
                      onPress={() => addMemberMutation.mutate(user.id)}
                    />
                  )
                }
                onPressUser={() => router.push(`/(stack)/${user.username}`)}
              />
            ))}
            {memberQuery.trim().length >= 2 && !isSearchingMembers && memberResults.length === 0 && (
              <Text style={{ color: theme.secondaryColor, fontSize: 13 }}>No users found.</Text>
            )}
          </View>
        )}

        {/* Current members */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader text={`Members (${members.length})`} theme={theme} />
          {members.length === 0 ? (
            <View
              style={{
                backgroundColor: containerBg,
                borderRadius: 14,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.secondaryColor, fontSize: 14 }}>
                {canManageMembers
                  ? "No members yet. Search above to add users."
                  : "This list has no members yet."}
              </Text>
            </View>
          ) : (
            members.map((member) => (
              <UserRow
                key={member.id}
                user={member.user}
                theme={theme}
                containerBg={containerBg}
                action={
                  canManageMembers ? (
                    <ActionButton
                      label="Remove"
                      color="#ef4444"
                      theme={theme}
                      loading={removeMemberMutation.isPending}
                      onPress={() => removeMemberMutation.mutate(member.userId)}
                    />
                  ) : null
                }
                onPressUser={() => router.push(`/(stack)/${member.user.username}`)}
              />
            ))
          )}
        </View>

        {/* Collaborators — owner only */}
        {isOwner && (
          <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
            <SectionHeader text={`Collaborators (${collaborators?.length ?? 0})`} theme={theme} />
            <Text style={{ color: theme.secondaryColor, fontSize: 12, marginBottom: 8 }}>
              Collaborators can add and remove members from this list.
            </Text>

            <TextInput
              value={collabQuery}
              onChangeText={handleCollabSearch}
              placeholder="Search users to add as collaborator..."
              placeholderTextColor={theme.secondaryColor}
              style={{
                backgroundColor: containerBg,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: theme.textColor,
                marginBottom: 8,
              }}
            />
            {isSearchingCollabs && (
              <Text style={{ color: theme.secondaryColor, fontSize: 13, marginBottom: 8 }}>
                Searching...
              </Text>
            )}
            {collabResults.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                theme={theme}
                containerBg={containerBg}
                action={
                  user.isCollaborator ? (
                    <ActionButton
                      label="Remove"
                      color="#ef4444"
                      theme={theme}
                      loading={removeCollabMutation.isPending}
                      onPress={() => removeCollabMutation.mutate(user.id)}
                    />
                  ) : (
                    <ActionButton
                      label="Add"
                      filled
                      theme={theme}
                      loading={addCollabMutation.isPending}
                      onPress={() => addCollabMutation.mutate(user.id)}
                    />
                  )
                }
                onPressUser={() => router.push(`/(stack)/${user.username}`)}
              />
            ))}
            {collabQuery.trim().length >= 2 && !isSearchingCollabs && collabResults.length === 0 && (
              <Text style={{ color: theme.secondaryColor, fontSize: 13, marginBottom: 8 }}>
                No users found.
              </Text>
            )}

            {/* Current collaborators */}
            {(collaborators ?? []).length > 0 && (
              <View style={{ marginTop: 8 }}>
                {collaborators!.map((collab) => (
                  <UserRow
                    key={collab.id}
                    user={collab.user}
                    theme={theme}
                    containerBg={containerBg}
                    action={
                      <ActionButton
                        label="Remove"
                        color="#ef4444"
                        theme={theme}
                        loading={removeCollabMutation.isPending}
                        onPress={() => removeCollabMutation.mutate(collab.userId)}
                      />
                    }
                    onPressUser={() => router.push(`/(stack)/${collab.user.username}`)}
                  />
                ))}
              </View>
            )}

            {(collaborators ?? []).length === 0 && collabQuery.trim().length === 0 && (
              <View
                style={{
                  backgroundColor: containerBg,
                  borderRadius: 14,
                  padding: 20,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.secondaryColor, fontSize: 14 }}>
                  No collaborators yet. Search above to add people who can manage this list.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Shared UI Components ──────────────────────────────────────────

function SectionHeader({ text, theme }: { text: string; theme: any }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        color: theme.secondaryColor,
        marginBottom: 10,
      }}
    >
      {text}
    </Text>
  );
}

function UserRow({
  user,
  theme,
  containerBg,
  action,
  onPressUser,
}: {
  user: MemberUser;
  theme: any;
  containerBg: string;
  action: React.ReactNode;
  onPressUser: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: containerBg,
        borderRadius: 12,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
      }}
    >
      <Image
        source={{ uri: avatarUri(user) }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.secondaryColor + "22" }}
      />
      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={onPressUser}>
        <Text
          style={{ fontWeight: "600", fontSize: 14, color: theme.textColor }}
          numberOfLines={1}
        >
          {displayName(user)}
        </Text>
        {user.username && (
          <Text style={{ fontSize: 13, color: theme.secondaryColor }} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
      </TouchableOpacity>
      {action}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  loading,
  filled,
  color,
  theme,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  filled?: boolean;
  color?: string;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        borderWidth: filled ? 0 : 1,
        borderColor: theme.secondaryColor + "44",
        backgroundColor: filled ? theme.linkColor : "transparent",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: filled ? "#fff" : color ?? theme.secondaryColor,
        }}
      >
        {loading ? "..." : label}
      </Text>
    </TouchableOpacity>
  );
}
