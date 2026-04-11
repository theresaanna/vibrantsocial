import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "@/lib/date";
import { LexicalRenderer } from "./lexical-renderer";
import { ReactionBar, type ReactionGroup } from "./reaction-bar";
import { ReactionPicker } from "./reaction-picker";
import { Poll, type PollOption } from "./poll";
import { PremiumBadge } from "./premium-badge";
import { ContentActionSheet } from "./content-action-sheet";
import { hexToRgba } from "@/lib/user-theme";
import { useUserTheme } from "./themed-view";
import { FramedAvatar } from "./framed-avatar";
import { StyledName } from "./styled-name";

interface PostAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  usernameFont?: string | null;
  tier?: "free" | "premium";
  // Theme fields (optional — included when available from feed)
  profileBgColor?: string | null;
  profileTextColor?: string | null;
  profileLinkColor?: string | null;
  profileSecondaryColor?: string | null;
  profileContainerColor?: string | null;
  profileContainerOpacity?: number | null;
  profileBgImage?: string | null;
}

interface QuotedPost {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  media?: { url: string; type: string }[];
}

interface PollData {
  question: string;
  options: PollOption[];
  expiresAt: string | null;
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  isNsfw?: boolean;
  isSensitive?: boolean;
  author: PostAuthor;
  _count: {
    comments: number;
    likes: number;
    reposts: number;
  };
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  media: { url: string; type: string }[];
  reactions?: ReactionGroup[];
  poll?: PollData | null;
  quotedPost?: QuotedPost | null;
}

export type { Post };

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [showNsfwContent, setShowNsfwContent] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const isNsfwHidden = (post.isNsfw || post.isSensitive) && !showNsfwContent;

  // Local optimistic state for reactions
  const [optimisticReactions, setOptimisticReactions] = useState<ReactionGroup[] | null>(null);
  const reactions = optimisticReactions ?? post.reactions ?? [];

  const toggleReaction = useMutation({
    mutationFn: (emoji: string) =>
      api.rpc("toggleCommentReaction", { commentId: post.id, emoji }),
    onMutate: async (emoji: string) => {
      if (!user) return;
      const prev = [...reactions];

      setOptimisticReactions((current) => {
        const list = [...(current ?? post.reactions ?? [])];
        const group = list.find((r) => r.emoji === emoji);
        if (group) {
          if (group.userIds.includes(user.id)) {
            const filtered = group.userIds.filter((id) => id !== user.id);
            if (filtered.length === 0) return list.filter((r) => r.emoji !== emoji);
            return list.map((r) =>
              r.emoji === emoji ? { ...r, userIds: filtered } : r,
            );
          }
          return list.map((r) =>
            r.emoji === emoji ? { ...r, userIds: [...r.userIds, user.id] } : r,
          );
        }
        return [...list, { emoji, userIds: [user.id] }];
      });

      return { prev };
    },
    onError: (_err, _emoji, context) => {
      if (context?.prev) setOptimisticReactions(context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const toggleRepost = useMutation({
    mutationFn: () => api.rpc("toggleRepost", { postId: post.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () => api.rpc("toggleBookmark", { postId: post.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      toggleReaction.mutate(emoji);
    },
    [toggleReaction],
  );

  // Single tap on heart defaults to heart reaction
  const handleHeartTap = useCallback(() => {
    toggleReaction.mutate("\u2764\uFE0F");
  }, [toggleReaction]);

  const handlePickerSelect = useCallback(
    (emoji: string) => {
      toggleReaction.mutate(emoji);
      setPickerVisible(false);
    },
    [toggleReaction],
  );

  // Use page-level theme from ThemedView context
  const pageTheme = useUserTheme();

  // Guard: skip rendering if post data is incomplete (after all hooks)
  if (!post?.author) return null;

  // Derive boolean flags from arrays (API returns arrays, not booleans)
  const isLiked = post.likes?.length > 0;
  const isBookmarked = post.bookmarks?.length > 0;
  const isReposted = post.reposts?.length > 0;
  const media = post.media ?? [];

  // Use the page-level theme for uniform styling
  const cardBg = hexToRgba(pageTheme.containerColor, pageTheme.containerOpacity);
  const textColor = pageTheme.textColor;
  const linkColor = pageTheme.linkColor;
  const secondaryColor = pageTheme.secondaryColor;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(stack)/post/${post.id}`)}
      onLongPress={() => setPickerVisible(true)}
      activeOpacity={0.7}
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: secondaryColor + "22",
        backgroundColor: cardBg,
      }}
    >
      {/* Author row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <FramedAvatar
          uri={post.author.avatar}
          size={40}
          frameId={post.author.profileFrameId}
        />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <StyledName fontId={post.author.usernameFont} style={{ fontWeight: "600", fontSize: 15, color: textColor }}>
              {post.author.displayName || post.author.username}
            </StyledName>
            {post.author.tier === "premium" && <PremiumBadge />}
          </View>
          {post.author.username && (
            <Text style={{ color: secondaryColor, fontSize: 13 }}>
              @{post.author.username}
            </Text>
          )}
        </View>
        <Text style={{ color: secondaryColor, fontSize: 12, marginRight: 8 }}>
          {formatDistanceToNow(new Date(post.createdAt))}
        </Text>
        <TouchableOpacity
          onPress={() => setShowActionSheet(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <Text style={{ fontSize: 18, color: secondaryColor }}>{"\u22EF"}</Text>
        </TouchableOpacity>
      </View>

      {/* NSFW / sensitive content overlay */}
      {isNsfwHidden ? (
        <TouchableOpacity
          onPress={() => setShowNsfwContent(true)}
          activeOpacity={0.8}
          style={{
            backgroundColor: "#1f2937",
            borderRadius: 12,
            padding: 24,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "#f3f4f6", fontSize: 18, marginBottom: 4 }}>
            {post.isNsfw ? "NSFW Content" : "Sensitive Content"}
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>
            Tap to reveal
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* Rich content via Lexical JSON renderer */}
          <View style={{ marginBottom: 8 }}>
            <LexicalRenderer content={post.content} />
          </View>

          {/* Media */}
          {(post.media ?? []).length > 0 && (
            <View style={{ marginBottom: 8, borderRadius: 12, overflow: "hidden" }}>
              <Image
                source={{ uri: post.media[0].url }}
                style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }}
                contentFit="cover"
              />
              {(post.media ?? []).length > 1 && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                    +{(post.media ?? []).length - 1}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Poll */}
          {post.poll && (
            <Poll
              postId={post.id}
              question={post.poll.question}
              options={post.poll.options}
              expiresAt={post.poll.expiresAt}
            />
          )}

          {/* Quoted post */}
          {post.quotedPost && (
            <QuotedPostCard quotedPost={post.quotedPost} />
          )}
        </>
      )}

      {/* Reaction bar (above action buttons) */}
      <ReactionBar
        reactions={reactions}
        currentUserId={user?.id}
        onToggleReaction={handleToggleReaction}
      />

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 24 }}>
        <ActionButton
          icon="💬"
          count={post._count.comments}
          active={false}
          activeColor={linkColor}
          inactiveColor={secondaryColor}
        />
        <ActionButton
          icon="🔁"
          count={post._count.reposts}
          active={isReposted}
          activeColor={linkColor}
          inactiveColor={secondaryColor}
          onPress={() => setShowRepostMenu(true)}
          onCountPress={() =>
            router.push(`/(stack)/post/${post.id}/reposts`)
          }
        />
        <TouchableOpacity
          onPress={handleHeartTap}
          onLongPress={() => setPickerVisible(true)}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text style={{ fontSize: 16 }}>
            {isLiked ? "❤️" : "🤍"}
          </Text>
          {post._count.likes > 0 && (
            <TouchableOpacity
              onPress={() => router.push(`/(stack)/post/${post.id}/likes`)}
            >
              <Text style={{ fontSize: 13, color: isLiked ? linkColor : secondaryColor }}>
                {post._count.likes}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        <ActionButton
          icon={isBookmarked ? "🔖" : "📑"}
          count={0}
          active={isBookmarked}
          activeColor={linkColor}
          inactiveColor={secondaryColor}
          onPress={() => toggleBookmark.mutate()}
        />
      </View>

      {/* Reaction picker */}
      <ReactionPicker
        visible={pickerVisible}
        onSelect={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
      />

      {/* Content action sheet (three-dot menu) */}
      <ContentActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        postId={post.id}
        postAuthorId={post.author.id}
        postAuthorUsername={post.author.username}
      />

      {/* Repost menu modal */}
      <Modal
        visible={showRepostMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRepostMenu(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setShowRepostMenu(false)}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              width: 260,
              overflow: "hidden",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setShowRepostMenu(false);
                toggleRepost.mutate();
              }}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              <Text style={{ fontSize: 16, color: "#1f2937" }}>
                {isReposted ? "Undo Repost" : "Repost"}
              </Text>
            </TouchableOpacity>
            {!isReposted && (
              <TouchableOpacity
                onPress={() => {
                  setShowRepostMenu(false);
                  router.push(`/(stack)/post/${post.id}/quote`);
                }}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                }}
              >
                <Text style={{ fontSize: 16, color: "#1f2937" }}>
                  Quote Post
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowRepostMenu(false)}
              style={{ paddingVertical: 16, paddingHorizontal: 20 }}
            >
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
}

function QuotedPostCard({ quotedPost }: { quotedPost: QuotedPost }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(stack)/post/${quotedPost.id}`)}
      activeOpacity={0.7}
      style={{
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        backgroundColor: "#fafafa",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <FramedAvatar
          uri={quotedPost.author.avatar}
          size={24}
          frameId={quotedPost.author.profileFrameId}
        />
        <StyledName fontId={quotedPost.author.usernameFont} style={{ fontWeight: "600", fontSize: 13, marginLeft: 6 }}>
          {quotedPost.author.displayName || quotedPost.author.username}
        </StyledName>
        {quotedPost.author.username && (
          <Text style={{ color: "#9ca3af", fontSize: 12, marginLeft: 4 }}>
            @{quotedPost.author.username}
          </Text>
        )}
        <Text style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto" }}>
          {formatDistanceToNow(new Date(quotedPost.createdAt))}
        </Text>
      </View>
      <Text style={{ fontSize: 14, lineHeight: 20, color: "#374151" }} numberOfLines={4}>
        {extractPlainText(quotedPost.content)}
      </Text>
      {quotedPost.media && quotedPost.media.length > 0 && (
        <Image
          source={{ uri: quotedPost.media[0].url }}
          style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 8, marginTop: 8 }}
          contentFit="cover"
        />
      )}
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  count,
  active,
  onPress,
  onCountPress,
  activeColor = "#c026d3",
  inactiveColor = "#9ca3af",
}: {
  icon: string;
  count: number;
  active: boolean;
  onPress?: () => void;
  onCountPress?: () => void;
  activeColor?: string;
  inactiveColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <TouchableOpacity onPress={onPress}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </TouchableOpacity>
      {count > 0 && (
        <TouchableOpacity onPress={onCountPress}>
          <Text style={{ fontSize: 13, color: active ? activeColor : inactiveColor }}>
            {count}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Extract plain text from Lexical JSON content.
 * Used for quoted post previews where we want simple text.
 */
function extractPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const texts: string[] = [];
    function walk(node: { type?: string; text?: string; children?: unknown[] }) {
      if (node.text) texts.push(node.text);
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          walk(child as typeof node);
        }
      }
    }
    walk(parsed.root ?? parsed);
    return texts.join(" ").trim();
  } catch {
    return content;
  }
}
