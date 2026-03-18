"use client";

import { SparkleFall } from "react-sparklefall";
import { parseJsonArray, SPARKLEFALL_DEFAULTS } from "@/lib/sparklefall-presets";

interface ProfileSparklefallProps {
  sparkles: string | null;
  colors: string | null;
  interval: number | null;
  wind: number | null;
  maxSparkles: number | null;
  minSize: number | null;
  maxSize: number | null;
}

export function ProfileSparklefall({
  sparkles,
  colors,
  interval,
  wind,
  maxSparkles,
  minSize,
  maxSize,
}: ProfileSparklefallProps) {
  const parsedSparkles = parseJsonArray(sparkles) ?? ["✨", "⭐", "💫", "🌟"];
  const parsedColors = parseJsonArray(colors) ?? undefined;

  return (
    <SparkleFall
      sparkles={parsedSparkles}
      colors={parsedColors}
      interval={interval ?? SPARKLEFALL_DEFAULTS.interval}
      wind={wind ?? SPARKLEFALL_DEFAULTS.wind}
      maxSparkles={maxSparkles ?? SPARKLEFALL_DEFAULTS.maxSparkles}
      minSize={minSize ?? SPARKLEFALL_DEFAULTS.minSize}
      maxSize={maxSize ?? SPARKLEFALL_DEFAULTS.maxSize}
      zIndex={1}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
