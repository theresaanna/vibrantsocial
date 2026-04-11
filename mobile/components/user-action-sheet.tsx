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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ReportModal } from "./report-modal";

interface UserActionSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

/**
 * Three-dot action sheet for user profiles.
 * Shows: Block, Mute, Report, Share.
 */
export function UserActionSheet({
  visible,
  onClose,
  userId,
  username,
}: UserActionSheetProps) {
  const queryClient = useQueryClient();
  const [showReport, setShowReport] = useState(false);

  const blockUser = useMutation({
    mutationFn: () => api.rpc("toggleBlock", userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
      onClose();
    },
  });

  const muteUser = useMutation({
    mutationFn: () => api.rpc("toggleMute", userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
      onClose();
    },
  });

  const handleBlock = () => {
    onClose();
    Alert.alert(
      "Block User",
      `Are you sure you want to block @${username}? They won't be able to see your content and you won't see theirs. Existing follows and friend connections will be removed.`,
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
      `Mute @${username}? Their posts will be hidden from your feed.`,
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

  const handleShare = async () => {
    const url = `https://vibrantsocial.app/@${username}`;
    await Share.share({ url, message: url });
    onClose();
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

            <ActionRow icon="📤" label="Share Profile" onPress={handleShare} />
            <Separator />
            <ActionRow
              icon="🚫"
              label={`Block @${username}`}
              onPress={handleBlock}
              destructive
            />
            <ActionRow
              icon="🔇"
              label={`Mute @${username}`}
              onPress={handleMute}
              destructive
            />
            <ActionRow
              icon="🚩"
              label="Report User"
              onPress={handleReport}
              destructive
            />
            <Separator />
            <ActionRow icon="" label="Cancel" onPress={onClose} muted />
          </Pressable>
        </Pressable>
      </Modal>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="profile"
        contentId={userId}
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
