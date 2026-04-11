import { View, Text, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PostCard } from "@/components/post-card";
import { CommentItem, type CommentData } from "@/components/comment-item";
import type { ReactionGroup } from "@/components/reaction-bar";
import { ThemedView, useUserTheme } from "@/components/themed-view";
import { Sparklefall } from "@/components/sparklefall";
import Toast from "react-native-toast-message";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: rawPost, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.rpc<any>("fetchSinglePost", id),
  });

  // fetchSinglePost returns { type, data, date } — unwrap to get the actual post
  const post = rawPost?.data ?? rawPost;

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" />
      </View>
    );
  }

  // Wrap in the post author's theme
  return (
    <ThemedView themeData={post.author}>
      <PostDetailContent post={post} />
      {post.author?.sparklefallEnabled && post.author?.sparklefallPreset && (
        <Sparklefall preset={post.author.sparklefallPreset} />
      )}
    </ThemedView>
  );
}

function PostDetailContent({ post }: { post: any }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const theme = useUserTheme();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);

  const { data: commentsRaw } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.rpc<CommentData[]>("fetchComments", id),
    enabled: !!post,
  });

  const [optimisticComments, setOptimisticComments] = useState<CommentData[] | null>(null);
  const comments: CommentData[] = optimisticComments ?? commentsRaw ?? [];

  const prevCommentsRef = useState<CommentData[] | undefined>(undefined);
  if (commentsRaw && commentsRaw !== prevCommentsRef[0]) {
    prevCommentsRef[0] = commentsRaw;
    if (optimisticComments) setOptimisticComments(null);
  }

  const addComment = useMutation({
    mutationFn: (payload: { content: string; parentId?: string }) =>
      api.rpc<{ success: boolean; comment?: CommentData }>("createComment", {
        postId: id,
        content: payload.content,
        ...(payload.parentId ? { parentId: payload.parentId } : {}),
      }),
    onSuccess: (result, variables) => {
      if (result?.comment) {
        const newComment: CommentData = {
          ...result.comment,
          replies: [],
        };
        setOptimisticComments((prev) => {
          const list = prev ?? comments;
          if (variables.parentId) {
            return addReplyToTree(list, variables.parentId, newComment);
          }
          return [...list, newComment];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      setCommentText("");
      setReplyingTo(null);
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to add comment" });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: (payload: { commentId: string; emoji: string }) =>
      api.rpc("toggleCommentReaction", payload),
    onMutate: async ({ commentId, emoji }) => {
      if (!user) return;
      setOptimisticComments((prev) => {
        const list = prev ?? comments;
        return updateCommentReactions(list, commentId, emoji, user.id);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const handleToggleReaction = useCallback(
    (commentId: string, emoji: string) => {
      toggleReaction.mutate({ commentId, emoji });
    },
    [toggleReaction],
  );

  const handleReply = useCallback((commentId: string, authorName: string) => {
    setReplyingTo({ id: commentId, name: authorName });
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={{ flex: 1 }}>
        <PostCard post={post} />

        <View style={{ padding: 16 }}>
          <Text style={{ fontWeight: "600", fontSize: 16, marginBottom: 12, color: theme.textColor }}>
            Comments ({comments.length})
          </Text>

          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onReply={handleReply}
              onToggleReaction={handleToggleReaction}
            />
          ))}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={{
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: theme.secondaryColor + "33",
        backgroundColor: theme.containerColor + "88",
      }}>
        {replyingTo && (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 }}>
            <Text style={{ fontSize: 12, color: theme.secondaryColor }}>
              Replying to {replyingTo.name}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.secondaryColor }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : "Add a comment..."}
            placeholderTextColor={theme.secondaryColor}
            value={commentText}
            onChangeText={setCommentText}
            style={{
              flex: 1,
              backgroundColor: theme.containerColor,
              color: theme.textColor,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
            }}
          />
          <TouchableOpacity
            onPress={() => {
              const trimmed = commentText.trim();
              if (trimmed) {
                addComment.mutate({
                  content: trimmed,
                  parentId: replyingTo?.id,
                });
              }
            }}
            disabled={!commentText.trim() || addComment.isPending}
            style={{ marginLeft: 8 }}
          >
            <Text style={{ color: commentText.trim() ? theme.linkColor : theme.secondaryColor, fontWeight: "600", fontSize: 15 }}>
              Post
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function addReplyToTree(
  comments: CommentData[],
  parentId: string,
  reply: CommentData,
): CommentData[] {
  return comments.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies ?? []), reply] };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: addReplyToTree(c.replies, parentId, reply) };
    }
    return c;
  });
}

function updateCommentReactions(
  comments: CommentData[],
  commentId: string,
  emoji: string,
  userId: string,
): CommentData[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      const reactions: ReactionGroup[] = [...(c.reactions ?? [])];
      const group = reactions.find((r) => r.emoji === emoji);
      if (group) {
        if (group.userIds.includes(userId)) {
          const filtered = group.userIds.filter((id) => id !== userId);
          if (filtered.length === 0) {
            return { ...c, reactions: reactions.filter((r) => r.emoji !== emoji) };
          }
          return { ...c, reactions: reactions.map((r) => r.emoji === emoji ? { ...r, userIds: filtered } : r) };
        }
        return { ...c, reactions: reactions.map((r) => r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r) };
      }
      return { ...c, reactions: [...reactions, { emoji, userIds: [userId] }] };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateCommentReactions(c.replies, commentId, emoji, userId) };
    }
    return c;
  });
}
