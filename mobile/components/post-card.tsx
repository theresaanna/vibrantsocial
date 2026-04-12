import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
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

// ── SVG Icon Components (matching web app) ─────────────────────────

function HeartIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </Svg>
  );
}

function CommentIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
    </Svg>
  );
}

function RepostIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
    </Svg>
  );
}

function BookmarkIcon({ filled, color, size = 18 }: { filled: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </Svg>
  );
}

function ShareIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </Svg>
  );
}

// ── Types ───────────────────────────────────────────────────────────

interface PostAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileFrameId: string | null;
  usernameFont?: string | null;
  tier?: "free" | "premium";
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
  reactions?: ReactionGroup[];
  poll?: PollData | null;
  quotedPost?: QuotedPost | null;
}

export type { Post };

// ── Action colors (matching web) ───────────────────────────────────

const COLORS = {
  like: { active: "#ef4444", inactive: "#71717a" },       // red-500 / zinc-500
  comment: { active: "#3b82f6", inactive: "#71717a" },    // blue-500 / zinc-500
  repost: { active: "#22c55e", inactive: "#71717a" },     // green-500 / zinc-500
  bookmark: { active: "#eab308", inactive: "#71717a" },   // yellow-500 / zinc-500
  share: { inactive: "#71717a" },                          // zinc-500
};

// ── PostCard ───────────────────────────────────────────────────────

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [showNsfwContent, setShowNsfwContent] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [copied, setCopied] = useState(false);

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
            return list.map((r) => r.emoji === emoji ? { ...r, userIds: filtered } : r);
          }
          return list.map((r) => r.emoji === emoji ? { ...r, userIds: [...r.userIds, user.id] } : r);
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
    (emoji: string) => toggleReaction.mutate(emoji),
    [toggleReaction],
  );

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

  const handleShare = useCallback(async () => {
    const url = `https://www.vibrantsocial.app/post/${post.id}`;
    if (Platform.OS !== "web") {
      try { await Share.share({ url }); } catch {}
    } else {
      try {
        await Clipboard.setStringAsync(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }, [post.id]);

  // Use page-level theme from ThemedView context
  const pageTheme = useUserTheme();

  // Guard: skip rendering if post data is incomplete (after all hooks)
  if (!post?.author) return null;

  // Derive boolean flags from arrays (API returns arrays, not booleans)
  const isLiked = Array.isArray(post.likes) ? post.likes.length > 0 : !!post.isLiked;
  const isBookmarked = Array.isArray(post.bookmarks) ? post.bookmarks.length > 0 : !!post.isBookmarked;
  const isReposted = Array.isArray(post.reposts) ? post.reposts.length > 0 : !!post.isReposted;

  const cardBg = hexToRgba(pageTheme.containerColor, pageTheme.containerOpacity);
  const textColor = pageTheme.textColor;
  const secondaryColor = pageTheme.secondaryColor;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(stack)/post/${post.id}`)}
      onLongPress={() => setPickerVisible(true)}
      activeOpacity={0.7}
      style={{
        padding: 16,
        marginHorizontal: 12,
        marginVertical: 6,
        borderRadius: 16,
        backgroundColor: cardBg,
      }}
    >
      {/* Author row */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <FramedAvatar uri={post.author.avatar} size={40} frameId={post.author.profileFrameId} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <StyledName fontId={post.author.usernameFont} style={{ fontWeight: "600", fontSize: 15, color: textColor }}>
              {post.author.displayName || post.author.username}
            </StyledName>
            {post.author.tier === "premium" && <PremiumBadge />}
          </View>
          {post.author.username && (
            <Text style={{ color: secondaryColor, fontSize: 13 }}>@{post.author.username}</Text>
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
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Tap to reveal</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* Rich content via Lexical JSON renderer (images are embedded in Lexical content) */}
          <View style={{ marginBottom: 8 }}>
            <LexicalRenderer content={post.content} />
          </View>

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
          {post.quotedPost && <QuotedPostCard quotedPost={post.quotedPost} />}
        </>
      )}

      {/* Reaction bar */}
      <ReactionBar
        reactions={reactions}
        currentUserId={user?.id}
        onToggleReaction={handleToggleReaction}
      />

      {/* Action buttons — matching web order: Like, Comment, Repost, Bookmark, Share */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {/* Like */}
        <TouchableOpacity
          onPress={handleHeartTap}
          onLongPress={() => setPickerVisible(true)}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
        >
          <HeartIcon filled={isLiked} color={isLiked ? COLORS.like.active : COLORS.like.inactive} />
          {post._count.likes > 0 && (
            <TouchableOpacity onPress={() => router.push(`/(stack)/post/${post.id}/likes`)}>
              <Text style={{ fontSize: 13, color: isLiked ? COLORS.like.active : COLORS.like.inactive }}>
                {post._count.likes}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          onPress={() => router.push(`/(stack)/post/${post.id}`)}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
        >
          <CommentIcon color={post._count.comments > 0 ? COLORS.comment.active : COLORS.comment.inactive} />
          {post._count.comments > 0 && (
            <Text style={{ fontSize: 13, color: COLORS.comment.active }}>{post._count.comments}</Text>
          )}
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity
          onPress={() => setShowRepostMenu(true)}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
        >
          <RepostIcon color={isReposted ? COLORS.repost.active : COLORS.repost.inactive} />
          {post._count.reposts > 0 && (
            <TouchableOpacity onPress={() => router.push(`/(stack)/post/${post.id}/reposts`)}>
              <Text style={{ fontSize: 13, color: isReposted ? COLORS.repost.active : COLORS.repost.inactive }}>
                {post._count.reposts}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Bookmark */}
        <TouchableOpacity
          onPress={() => toggleBookmark.mutate()}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
        >
          <BookmarkIcon filled={isBookmarked} color={isBookmarked ? COLORS.bookmark.active : COLORS.bookmark.inactive} />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.6}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
        >
          {copied ? (
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#16a34a" }}>Copied!</Text>
          ) : (
            <ShareIcon color={COLORS.share.inactive} />
          )}
        </TouchableOpacity>
      </View>

      {/* Reaction picker */}
      <ReactionPicker visible={pickerVisible} onSelect={handlePickerSelect} onClose={() => setPickerVisible(false)} />

      {/* Content action sheet */}
      <ContentActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        postId={post.id}
        postAuthorId={post.author.id}
        postAuthorUsername={post.author.username}
      />

      {/* Repost menu modal */}
      <Modal visible={showRepostMenu} transparent animationType="fade" onRequestClose={() => setShowRepostMenu(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setShowRepostMenu(false)}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 16, width: 260, overflow: "hidden" }}>
            <TouchableOpacity
              onPress={() => { setShowRepostMenu(false); toggleRepost.mutate(); }}
              style={{ paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}
            >
              <Text style={{ fontSize: 16, color: "#1f2937" }}>{isReposted ? "Undo Repost" : "Repost"}</Text>
            </TouchableOpacity>
            {!isReposted && (
              <TouchableOpacity
                onPress={() => { setShowRepostMenu(false); router.push(`/(stack)/post/${post.id}/quote`); }}
                style={{ paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}
              >
                <Text style={{ fontSize: 16, color: "#1f2937" }}>Quote Post</Text>
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

// ── QuotedPostCard ─────────────────────────────────────────────────

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
        <FramedAvatar uri={quotedPost.author.avatar} size={24} frameId={quotedPost.author.profileFrameId} />
        <StyledName fontId={quotedPost.author.usernameFont} style={{ fontWeight: "600", fontSize: 13, marginLeft: 6 }}>
          {quotedPost.author.displayName || quotedPost.author.username}
        </StyledName>
        {quotedPost.author.username && (
          <Text style={{ color: "#9ca3af", fontSize: 12, marginLeft: 4 }}>@{quotedPost.author.username}</Text>
        )}
        <Text style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto" }}>
          {formatDistanceToNow(new Date(quotedPost.createdAt))}
        </Text>
      </View>
      <View style={{ maxHeight: 120, overflow: "hidden" }}>
        <LexicalRenderer content={quotedPost.content} />
      </View>
    </TouchableOpacity>
  );
}

