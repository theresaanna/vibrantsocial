import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Alert,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ReportModal } from "./report-modal";

interface ContentActionSheetProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postAuthorId: string;
  postAuthorUsername: string | null;
}

/**
 * Three-dot action sheet for posts.
 * Shows: Copy link, Share, Block user, Mute user, Report post, Delete (own posts only).
 */
export function ContentActionSheet({
  visible,
  onClose,
  postId,
  postAuthorId,
  postAuthorUsername,
}: ContentActionSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showReport, setShowReport] = useState(false);
  const isOwnPost = user?.id === postAuthorId;

  const blockUser = useMutation({
    mutationFn: () => api.rpc("toggleBlock", postAuthorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      onClose();
    },
  });

  const muteUser = useMutation({
    mutationFn: () => api.rpc("toggleMute", postAuthorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      onClose();
    },
  });

  const deletePost = useMutation({
    mutationFn: () => api.rpc("deletePost", postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      onClose();
    },
  });

  const handleCopyLink = async () => {
    const url = `https://vibrantsocial.app/post/${postId}`;
    await Clipboard.setStringAsync(url);
    onClose();
  };

  const handleShare = async () => {
    const url = `https://vibrantsocial.app/post/${postId}`;
    await Share.share({ url, message: url });
    onClose();
  };

  const handleBlock = () => {
    onClose();
    Alert.alert(
      "Block User",
      `Are you sure you want to block @${postAuthorUsername ?? "this user"}? They won't be able to see your content and you won't see theirs.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => blockUser.mutate(),
        },
      ]
    );
  };

  const handleMute = () => {
    onClose();
    Alert.alert(
      "Mute User",
      `Mute @${postAuthorUsername ?? "this user"}? Their posts will be hidden from your feed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: () => muteUser.mutate(),
        },
      ]
    );
  };

  const handleReport = () => {
    onClose();
    setShowReport(true);
  };

  const handleDelete = () => {
    onClose();
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePost.mutate(),
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={onClose}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 34,
            }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#d1d5db",
                }}
              />
            </View>

            <ActionRow icon="🔗" label="Copy Link" onPress={handleCopyLink} />
            <ActionRow icon="📤" label="Share" onPress={handleShare} />

            {!isOwnPost && (
              <>
                <Separator />
                <ActionRow
                  icon="🚫"
                  label={`Block @${postAuthorUsername ?? "user"}`}
                  onPress={handleBlock}
                  destructive
                />
                <ActionRow
                  icon="🔇"
                  label={`Mute @${postAuthorUsername ?? "user"}`}
                  onPress={handleMute}
                  destructive
                />
                <ActionRow
                  icon="🚩"
                  label="Report Post"
                  onPress={handleReport}
                  destructive
                />
              </>
            )}

            {isOwnPost && (
              <>
                <Separator />
                <ActionRow
                  icon="🗑️"
                  label="Delete Post"
                  onPress={handleDelete}
                  destructive
                />
              </>
            )}

            <Separator />
            <ActionRow icon="" label="Cancel" onPress={onClose} muted />
          </Pressable>
        </Pressable>
      </Modal>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="post"
        contentId={postId}
      />
    </>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
  muted,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  muted?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 20,
      }}
    >
      {icon ? (
        <Text style={{ fontSize: 18, marginRight: 12, width: 24, textAlign: "center" }}>
          {icon}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 16,
          color: destructive ? "#ef4444" : muted ? "#9ca3af" : "#1f2937",
          fontWeight: destructive ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Separator() {
  return <View style={{ height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 20 }} />;
}
