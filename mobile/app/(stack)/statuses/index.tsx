import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import { StatusComposer } from "@/components/status-composer";
import { StatusViewer, type FriendStatus } from "@/components/status-viewer";
import { formatDistanceToNow } from "@/lib/date";

const PURPLE = "#c026d3";

export default function StatusesFeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showComposer, setShowComposer] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const {
    data,
    refetch,
    isRefetching,
    isLoading,
  } = useQuery({
    queryKey: ["friendStatuses"],
    queryFn: () =>
      api.rpc<{
        ownStatus: FriendStatus | null;
        friendStatuses: FriendStatus[];
      }>("pollStatuses", 50),
  });

  const allStatuses = [
    ...(data?.ownStatus ? [data.ownStatus] : []),
    ...(data?.friendStatuses ?? []).filter(
      (s) => s.id !== data?.ownStatus?.id
    ),
  ];

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: FriendStatus; index: number }) => {
      const isOwn = user?.id === item.user.id;
      return (
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
              <Text style={styles.statusName}>
                {item.user.displayName ||
                  item.user.name ||
                  item.user.username}
                {isOwn && (
                  <Text style={styles.youBadge}> (you)</Text>
                )}
              </Text>
              <Text style={styles.statusTime}>
                {formatDistanceToNow(new Date(item.createdAt))}
              </Text>
            </View>
            <Text
              style={[
                styles.statusText,
                isOwn && styles.statusTextOwn,
              ]}
              numberOfLines={2}
            >
              {item.content}
            </Text>
            <View style={styles.statusMeta}>
              <Text style={styles.metaText}>
                {item.isLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"}{" "}
                {item.likeCount > 0 ? item.likeCount : ""}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [user, openViewer]
  );

  if (showComposer) {
    return (
      <View style={styles.container}>
        <View style={styles.composerHeader}>
          <TouchableOpacity onPress={() => setShowComposer(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.composerTitle}>New Status</Text>
          <View style={{ width: 60 }} />
        </View>
        <StatusComposer onCreated={() => setShowComposer(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Add status button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowComposer(true)}
      >
        <Text style={styles.addButtonText}>+ Set your status</Text>
      </TouchableOpacity>

      <FlashList
        data={allStatuses}
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
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No friend statuses yet. Set yours to get started!
              </Text>
            </View>
          )
        }
      />

      <StatusViewer
        visible={viewerVisible}
        statuses={allStatuses}
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
  addButton: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PURPLE,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
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
    alignItems: "baseline",
    marginBottom: 2,
  },
  statusName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  youBadge: {
    fontSize: 12,
    fontWeight: "400",
    color: PURPLE,
  },
  statusTime: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: 8,
  },
  statusText: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 20,
  },
  statusTextOwn: {
    fontWeight: "700",
    color: "#1f2937",
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
  composerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cancelText: {
    color: PURPLE,
    fontSize: 15,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
});
