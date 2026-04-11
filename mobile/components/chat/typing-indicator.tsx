import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import type { ChatUserProfile } from "@vibrantsocial/shared/types";

interface TypingIndicatorProps {
  typingUserIds: Set<string>;
  participants: Map<string, ChatUserProfile>;
  currentUserId: string;
}

function AnimatedDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <Animated.View
      style={{
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: "#9ca3af",
        marginHorizontal: 1,
        transform: [{ translateY }],
      }}
    />
  );
}

export function TypingIndicator({
  typingUserIds,
  participants,
  currentUserId,
}: TypingIndicatorProps) {
  const others = [...typingUserIds].filter((id) => id !== currentUserId);

  if (others.length === 0) return null;

  const names = others.map((id) => {
    const p = participants.get(id);
    return p?.displayName ?? p?.username ?? p?.name ?? "Someone";
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names.length} people are typing`;
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginRight: 6 }}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={150} />
        <AnimatedDot delay={300} />
      </View>
      <Text style={{ fontSize: 12, color: "#9ca3af" }}>{text}</Text>
    </View>
  );
}
