import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, Text, useWindowDimensions } from "react-native";

export interface SparklefallPreset {
  label: string;
  emoji: string;
  sparkles: string[];
}

export const SPARKLEFALL_PRESETS: Record<string, SparklefallPreset> = {
  default: { label: "Default", emoji: "\u2728", sparkles: ["\u2728", "\u2b50", "\ud83d\udcab", "\ud83c\udf1f"] },
  goldRush: { label: "Gold Rush", emoji: "\ud83c\udf1f", sparkles: ["\ud83c\udf1f", "\ud83d\udc9b", "\u2b50", "\u2728"] },
  holiday: { label: "Holiday", emoji: "\ud83c\udf84", sparkles: ["\ud83c\udf84", "\ud83c\udf81", "\u2b50", "\u2744\ufe0f"] },
  minimal: { label: "Minimal", emoji: "\u2022", sparkles: ["\u2022", "\u00b7", "\u2218"] },
  hearts: { label: "Hearts", emoji: "\ud83d\udc95", sparkles: ["\ud83d\udc95", "\u2764\ufe0f", "\ud83d\udc97", "\ud83d\udc96"] },
  nature: { label: "Nature", emoji: "\ud83c\udf43", sparkles: ["\ud83c\udf43", "\ud83c\udf3f", "\ud83c\udf40", "\ud83c\udf31"] },
  space: { label: "Space", emoji: "\ud83d\ude80", sparkles: ["\ud83d\ude80", "\ud83c\udf19", "\u2b50", "\ud83e\ude90"] },
  party: { label: "Party", emoji: "\ud83c\udf89", sparkles: ["\ud83c\udf89", "\ud83c\udf8a", "\ud83e\udd73", "\ud83c\udf88"] },
  spring: { label: "Spring", emoji: "\ud83c\udf37", sparkles: ["\ud83c\udf37", "\ud83c\udf38", "\ud83c\udf3c", "\ud83e\udd8b"] },
  summer: { label: "Summer", emoji: "\u2600\ufe0f", sparkles: ["\u2600\ufe0f", "\ud83c\udf0a", "\ud83c\udfd6\ufe0f", "\ud83c\udf34"] },
  winter: { label: "Winter", emoji: "\u2744\ufe0f", sparkles: ["\u2744\ufe0f", "\u26c4", "\ud83c\udf28\ufe0f", "\ud83e\uddca"] },
  autumn: { label: "Autumn", emoji: "\ud83c\udf42", sparkles: ["\ud83c\udf42", "\ud83c\udf41", "\ud83c\udf3e", "\ud83c\udf83"] },
};

export function getPresetSparkles(presetName: string | null | undefined): string[] {
  if (!presetName) return SPARKLEFALL_PRESETS.default.sparkles;
  return SPARKLEFALL_PRESETS[presetName]?.sparkles ?? SPARKLEFALL_PRESETS.default.sparkles;
}

interface Particle {
  id: number;
  emoji: string;
  x: number;
  size: number;
  spinDirection: 1 | -1;
  animY: Animated.Value;
  animOpacity: Animated.Value;
  animX: Animated.Value;
  animSpin: Animated.Value;
}

interface SparklefallProps {
  sparkles?: string[];
  presetName?: string | null;
  interval?: number;
  maxSparkles?: number;
  wind?: number;
  minSize?: number;
  maxSize?: number;
}

export function Sparklefall({
  sparkles,
  presetName,
  interval = 800,
  maxSparkles = 50,
  wind = 0,
  minSize = 10,
  maxSize = 30,
}: SparklefallProps) {
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const activeEmojis = sparkles ?? getPresetSparkles(presetName);

  useEffect(() => {
    const timer = setInterval(() => {
      setParticles((prev) => {
        if (prev.length >= maxSparkles) return prev;

        const id = nextId.current++;
        const emoji = activeEmojis[Math.floor(Math.random() * activeEmojis.length)];
        const x = Math.random() * (width - 30);
        const size = minSize + Math.random() * (maxSize - minSize);
        const duration = 3000 + Math.random() * 2000;
        const windDrift = wind * 50 + (Math.random() - 0.5) * 30;
        const spinDirection: 1 | -1 = Math.random() > 0.5 ? 1 : -1;

        const animY = new Animated.Value(-size);
        const animOpacity = new Animated.Value(1);
        const animX = new Animated.Value(0);
        const animSpin = new Animated.Value(0);

        Animated.parallel([
          Animated.timing(animY, {
            toValue: height + size,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(duration * 0.7),
            Animated.timing(animOpacity, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animX, {
            toValue: windDrift,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animSpin, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setParticles((p) => p.filter((item) => item.id !== id));
        });

        return [...prev, { id, emoji, x, size, spinDirection, animY, animOpacity, animX, animSpin }];
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeEmojis, interval, maxSparkles, width, height, wind, minSize, maxSize]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {particles.map((p) => {
        // Each particle spins 1-3 full rotations as it falls
        const rotations = 1 + Math.abs(p.id % 3);
        const rotate = p.animSpin.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${p.spinDirection * rotations * 360}deg`],
        });

        return (
          <Animated.View
            key={p.id}
            style={{
              position: "absolute",
              left: p.x,
              transform: [
                { translateY: p.animY },
                { translateX: p.animX },
                { rotate },
              ],
              opacity: p.animOpacity,
            }}
          >
            <Text style={{ fontSize: p.size }}>{p.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
