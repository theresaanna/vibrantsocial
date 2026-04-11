import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  Dimensions,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import { formatDistanceToNow } from "@/lib/date";

const PURPLE = "#c026d3";
const AUTO_ADVANCE_MS = 5000;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Re-export the type so status-bar.tsx can import it
export interface FriendStatus {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
    profileFrameId: string | null;
    usernameFont: string | null;
  };
}

interface StatusViewerProps {
  visible: boolean;
  statuses: FriendStatus[];
  initialIndex?: number;
  onClose: () => void;
}

const GRADIENT_BACKGROUNDS = [
  ["#7c3aed", "#c026d3"],
  ["#2563eb", "#06b6d4"],
  ["#059669", "#10b981"],
  ["#dc2626", "#f97316"],
  ["#1f2937", "#4b5563"],
  ["#7c3aed", "#ec4899"],
];

function getGradientBackground(index: number): string {
  const pair = GRADIENT_BACKGROUNDS[index % GRADIENT_BACKGROUNDS.length];
  return pair[0];
}

export function StatusViewer({
  visible,
  statuses,
  initialIndex = 0,
  onClose,
}: StatusViewerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState("");
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStatus = statuses[currentIndex];

  // Reset index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setReplyText("");
    }
  }, [visible, initialIndex]);

  // Auto-advance progress bar
  useEffect(() => {
    if (!visible || !currentStatus) return;

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: AUTO_ADVANCE_MS,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && currentIndex < statuses.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (finished) {
        onClose();
      }
    });

    return () => {
      animation.stop();
    };
  }, [visible, currentIndex, currentStatus, statuses.length]);

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: (statusId: string) => api.rpc("toggleStatusLike", statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendStatuses"] });
      queryClient.invalidateQueries({ queryKey: ["userStatuses"] });
    },
  });

  // Reply mutation (starts a conversation)
  const replyMutation = useMutation({
    mutationFn: (data: { userId: string; message: string }) =>
      api.rpc("replyToStatus", data.userId, data.message),
    onSuccess: () => {
      setReplyText("");
    },
  });

  const handleTapLeft = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleTapRight = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, statuses.length, onClose]);

  const handleLike = useCallback(() => {
    if (currentStatus) {
      likeMutation.mutate(currentStatus.id);
    }
  }, [currentStatus, likeMutation]);

  const handleReply = useCallback(() => {
    if (currentStatus && replyText.trim()) {
      const message = `Replying to ${
        currentStatus.user.displayName || currentStatus.user.username
      }'s status: "${currentStatus.content}"\n\n${replyText.trim()}`;
      replyMutation.mutate({
        userId: currentStatus.user.id,
        message,
      });
    }
  }, [currentStatus, replyText, replyMutation]);

  if (!currentStatus) return null;

  const isOwn = user?.id === currentStatus.user.id;
  const bgColor = getGradientBackground(currentIndex);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { backgroundColor: bgColor }]}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {statuses.map((_, i) => (
              <View key={i} style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    i < currentIndex
                      ? { flex: 1 }
                      : i === currentIndex
                      ? {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        }
                      : { width: 0 },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Avatar
              uri={currentStatus.user.avatar || currentStatus.user.image}
              size={36}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>
                {currentStatus.user.displayName ||
                  currentStatus.user.name ||
                  currentStatus.user.username}
              </Text>
              <Text style={styles.headerTime}>
                {formatDistanceToNow(new Date(currentStatus.createdAt))}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
          </View>

          {/* Tap zones */}
          <View style={styles.tapZones}>
            <Pressable style={styles.tapLeft} onPress={handleTapLeft} />
            <Pressable style={styles.tapRight} onPress={handleTapRight} />
          </View>

          {/* Status content */}
          <View style={styles.contentContainer}>
            <Text style={styles.contentText}>{currentStatus.content}</Text>
          </View>

          {/* Bottom actions */}
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
              <Text style={styles.likeIcon}>
                {currentStatus.isLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"}
              </Text>
              {currentStatus.likeCount > 0 && (
                <Text style={styles.likeCount}>
                  {currentStatus.likeCount}
                </Text>
              )}
            </TouchableOpacity>

            {!isOwn && (
              <View style={styles.replyContainer}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Send a reply..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={styles.replyInput}
                  returnKeyType="send"
                  onSubmitEditing={handleReply}
                />
                {replyText.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={handleReply}
                    style={styles.sendButton}
                    disabled={replyMutation.isPending}
                  >
                    <Text style={styles.sendText}>Send</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  progressContainer: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  headerTime: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    top: 120,
    bottom: 120,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  contentText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 34,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    gap: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  likeIcon: {
    fontSize: 24,
  },
  likeCount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 4,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  sendText: {
    color: PURPLE,
    fontSize: 14,
    fontWeight: "600",
  },
});
