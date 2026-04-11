import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { formatDistanceToNow } from "@/lib/date";
import { ReactionBar, type ReactionGroup } from "./reaction-bar";
import { ReactionPicker } from "./reaction-picker";
import { FramedAvatar } from "./framed-avatar";
import { StyledName } from "./styled-name";

// ── Types ─────────────────────────────────────────────────────────────

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name?: string | null;
    avatar: string | null;
    image?: string | null;
    profileFrameId?: string | null;
    usernameFont?: string | null;
  };
  reactions?: ReactionGroup[];
  replies?: CommentData[];
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId?: string;
  depth?: number;
  onReply?: (commentId: string, authorName: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
}

const MAX_VISUAL_DEPTH = 4;

// ── Component ─────────────────────────────────────────────────────────

export function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  onReply,
  onToggleReaction,
}: CommentItemProps) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const authorName =
    comment.author.displayName || comment.author.name || comment.author.username || "User";
  const avatarUri = comment.author.avatar || comment.author.image || undefined;
  const reactions = comment.reactions ?? [];

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      onToggleReaction?.(comment.id, emoji);
    },
    [comment.id, onToggleReaction],
  );

  const handlePickerSelect = useCallback(
    (emoji: string) => {
      onToggleReaction?.(comment.id, emoji);
      setPickerVisible(false);
    },
    [comment.id, onToggleReaction],
  );

  return (
    <View>
      {/* This comment */}
      <View style={[styles.row, depth > 0 && styles.nested]}>
        <FramedAvatar
          uri={avatarUri}
          size={32}
          frameId={comment.author.profileFrameId}
        />
        <View style={styles.body}>
          {/* Author + timestamp */}
          <View style={styles.header}>
            <StyledName fontId={comment.author.usernameFont} style={styles.authorName}>{authorName}</StyledName>
            <Text style={styles.timestamp}>
              {formatDistanceToNow(new Date(comment.createdAt))}
            </Text>
          </View>

          {/* Comment text */}
          <Text style={styles.content}>{comment.content}</Text>

          {/* Reaction bar */}
          <ReactionBar
            reactions={reactions}
            currentUserId={currentUserId}
            onToggleReaction={handleToggleReaction}
          />

          {/* Action buttons */}
          <View style={styles.actions}>
            {onReply && (
              <TouchableOpacity
                onPress={() => onReply(comment.id, authorName)}
                activeOpacity={0.6}
              >
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
            )}
            {onToggleReaction && (
              <TouchableOpacity
                onPress={() => setPickerVisible(true)}
                onLongPress={() => setPickerVisible(true)}
                activeOpacity={0.6}
              >
                <Text style={styles.actionText}>React</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View
          style={
            depth < MAX_VISUAL_DEPTH
              ? styles.repliesIndented
              : styles.repliesFlat
          }
        >
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              depth={depth + 1}
              onReply={onReply}
              onToggleReaction={onToggleReaction}
            />
          ))}
        </View>
      )}

      {/* Reaction picker popover */}
      <ReactionPicker
        visible={pickerVisible}
        onSelect={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 12,
  },
  nested: {
    // visual nesting handled by parent container margins
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  body: {
    flex: 1,
    marginLeft: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  authorName: {
    fontWeight: "600",
    fontSize: 13,
    color: "#1f2937",
  },
  timestamp: {
    fontSize: 12,
    color: "#9ca3af",
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
  repliesIndented: {
    marginLeft: 32,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#f3f4f6",
  },
  repliesFlat: {
    marginTop: 4,
  },
});
