import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import { StatusViewer, type FriendStatus } from "@/components/status-viewer";
import { formatDistanceToNow } from "@/lib/date";

const PURPLE = "#c026d3";

export default function UserStatusesScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const {
    data: statuses = [],
    refetch,
    isRefetching,
    isLoading,
  } = useQuery({
    queryKey: ["userStatuses", username],
    queryFn: () =>
      api.rpc<FriendStatus[]>("getUserStatuses", username, 30),
    enabled: !!username,
  });

  const deleteMutation = useMutation({
    mutationFn: (statusId: string) => api.rpc("deleteStatus", statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userStatuses", username] });
      queryClient.invalidateQueries({ queryKey: ["friendStatuses"] });
    },
  });

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const isOwn = user?.username === username;

  const renderItem = useCallback(
    ({ item, index }: { item: FriendStatus; index: number }) => (
      <TouchableOpacity
        style={styles.statusItem}
        onPress={() => openViewer(index)}
        activeOpacity={0.7}
      >
        <Avatar
          uri={item.user.avatar || item.user.image}
          size={44}
        />
        <View style={styles.statusContent}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTime}>
              {formatDistanceToNow(new Date(item.createdAt))}
            </Text>
            {isOwn && (
              <TouchableOpacity
                onPress={() => deleteMutation.mutate(item.id)}
                hitSlop={8}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.statusText}>{item.content}</Text>
          <View style={styles.statusMeta}>
            <Text style={styles.metaText}>
              {item.isLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"}{" "}
              {item.likeCount > 0 ? item.likeCount : ""}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [isOwn, openViewer, deleteMutation]
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={statuses}
        renderItem={renderItem}
        estimatedItemSize={80}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={PURPLE}
          />
        }
        ListHeaderComponent={
          statuses[0] ? (
            <View style={styles.profileHeader}>
              <Avatar
                uri={statuses[0].user.avatar || statuses[0].user.image}
                size={60}
              />
              <Text style={styles.profileName}>
                {statuses[0].user.displayName ||
                  statuses[0].user.name ||
                  statuses[0].user.username}
              </Text>
              <Text style={styles.profileUsername}>
                @{statuses[0].user.username}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No statuses yet.</Text>
            </View>
          )
        }
      />

      <StatusViewer
        visible={viewerVisible}
        statuses={statuses}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 10,
  },
  profileUsername: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  statusItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    alignItems: "flex-start",
    gap: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statusTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  deleteText: {
    fontSize: 13,
    color: "#ef4444",
  },
  statusText: {
    fontSize: 15,
    color: "#1f2937",
    lineHeight: 20,
  },
  statusMeta: {
    flexDirection: "row",
    marginTop: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 15,
    textAlign: "center",
  },
});
