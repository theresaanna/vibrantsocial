import { View, Text } from "react-native";

interface PremiumBadgeProps {
  size?: "sm" | "md";
}

/**
 * Small badge shown next to premium usernames.
 * Renders a purple circle with a "+" icon.
 */
export function PremiumBadge({ size = "sm" }: PremiumBadgeProps) {
  const dim = size === "sm" ? 16 : 20;
  const fontSize = size === "sm" ? 10 : 13;

  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: "#c026d3",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize,
          fontWeight: "800",
          lineHeight: fontSize + 2,
        }}
      >
        +
      </Text>
    </View>
  );
}
