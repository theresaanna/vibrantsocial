import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { PremiumBadge } from "./premium-badge";

interface UserListItemProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    profileFrameId?: string | null;
    tier?: "free" | "premium";
  };
  /** Optional action button rendered on the right side */
  actionButton?: React.ReactNode;
  /** Override the default navigation on tap */
  onPress?: () => void;
}

/**
 * Reusable row component for displaying a user with avatar, display name,
 * and @username. Used across followers, following, friends, and search screens.
 */
export function UserListItem({ user, actionButton, onPress }: UserListItemProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (user.username) {
      router.push(`/(stack)/${user.username}`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
      }}
    >
      <Avatar
        uri={user.avatar}
        size={44}
        frameId={user.profileFrameId}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontWeight: "600", fontSize: 15, color: "#1f2937" }}>
            {user.displayName || user.username || "Unknown"}
          </Text>
          {user.tier === "premium" && <PremiumBadge />}
        </View>
        {user.username && (
          <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 1 }}>
            @{user.username}
          </Text>
        )}
      </View>
      {actionButton && <View style={{ marginLeft: 12 }}>{actionButton}</View>}
    </TouchableOpacity>
  );
}
