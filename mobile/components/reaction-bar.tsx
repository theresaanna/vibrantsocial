import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

interface ReactionBarProps {
  reactions: ReactionGroup[];
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
}

/**
 * Displays existing reactions as small emoji pills with counts.
 * Tapping a pill toggles the current user's reaction.
 * Shows a purple tinted background when the current user has reacted.
 */
export function ReactionBar({ reactions, currentUserId, onToggleReaction }: ReactionBarProps) {
  if (reactions.length === 0) return null;

  return (
    <View style={styles.container}>
      {reactions.map((reaction) => {
        const isReacted = currentUserId
          ? reaction.userIds.includes(currentUserId)
          : false;

        return (
          <TouchableOpacity
            key={reaction.emoji}
            onPress={() => onToggleReaction(reaction.emoji)}
            activeOpacity={0.7}
            style={[styles.pill, isReacted && styles.pillActive]}
          >
            <Text style={styles.emoji}>{reaction.emoji}</Text>
            <Text style={[styles.count, isReacted && styles.countActive]}>
              {reaction.userIds.length}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  pillActive: {
    borderColor: "#e9d5ff",
    backgroundColor: "#faf5ff",
  },
  emoji: {
    fontSize: 13,
  },
  count: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  countActive: {
    color: "#c026d3",
  },
});
