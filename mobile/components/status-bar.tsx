import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import type { FriendStatus } from "@/components/status-viewer";

const PURPLE = "#c026d3";
const AVATAR_SIZE = 56;
const RING_SIZE = AVATAR_SIZE + 6;

export function StatusBar() {
  const router = useRouter();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["friendStatuses"],
    queryFn: () =>
      api.rpc<{
        ownStatus: FriendStatus | null;
        friendStatuses: FriendStatus[];
      }>("pollStatuses", 20),
    refetchInterval: 30_000,
  });

  const ownStatus = data?.ownStatus ?? null;
  const friendStatuses = data?.friendStatuses ?? [];

  const handleAddStatus = useCallback(() => {
    router.push("/(stack)/statuses/" as any);
  }, [router]);

  const handleViewStatus = useCallback(
    (username: string) => {
      router.push(`/(stack)/statuses/${username}` as any);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add status / own status */}
        <TouchableOpacity
          style={styles.avatarItem}
          onPress={ownStatus ? () => handleViewStatus(user?.username ?? "") : handleAddStatus}
          activeOpacity={0.7}
        >
          <View style={[styles.ring, ownStatus ? styles.ringActive : styles.ringInactive]}>
            <Avatar uri={user?.avatar} size={AVATAR_SIZE} />
            {!ownStatus && (
              <View style={styles.plusBadge}>
                <Text style={styles.plusText}>+</Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {ownStatus ? "Your status" : "Add status"}
          </Text>
        </TouchableOpacity>

        {/* Friend statuses */}
        {friendStatuses.map((status) => (
          <TouchableOpacity
            key={status.id}
            style={styles.avatarItem}
            onPress={() => handleViewStatus(status.user.username ?? "")}
            activeOpacity={0.7}
          >
            <View style={[styles.ring, styles.ringActive]}>
              <Avatar
                uri={status.user.avatar || status.user.image}
                size={AVATAR_SIZE}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {status.user.displayName || status.user.username || "User"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  avatarItem: {
    alignItems: "center",
    width: 72,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
  },
  ringActive: {
    borderColor: PURPLE,
  },
  ringInactive: {
    borderColor: "#d1d5db",
  },
  plusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PURPLE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  plusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
});
