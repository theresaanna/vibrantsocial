export interface SparklefallConfig {
  sparklefallEnabled: boolean;
  sparklefallPreset: string | null;
  sparklefallSparkles: string | null;
  sparklefallColors: string | null;
  sparklefallInterval: number | null;
  sparklefallWind: number | null;
  sparklefallMaxSparkles: number | null;
  sparklefallMinSize: number | null;
  sparklefallMaxSize: number | null;
}

export interface SparklefallPreset {
  label: string;
  emoji: string;
  sparkles: string[];
}

export const SPARKLEFALL_PRESETS: Record<string, SparklefallPreset> = {
  default: { label: "Default", emoji: "✨", sparkles: ["✨", "⭐", "💫", "🌟"] },
  goldRush: { label: "Gold Rush", emoji: "🌟", sparkles: ["🌟", "💛", "⭐", "✨"] },
  holiday: { label: "Holiday", emoji: "🎄", sparkles: ["🎄", "🎁", "⭐", "❄️"] },
  minimal: { label: "Minimal", emoji: "•", sparkles: ["•", "·", "∘"] },
  hearts: { label: "Hearts", emoji: "💕", sparkles: ["💕", "❤️", "💗", "💖"] },
  nature: { label: "Nature", emoji: "🍃", sparkles: ["🍃", "🌿", "🍀", "🌱"] },
  space: { label: "Space", emoji: "🚀", sparkles: ["🚀", "🌙", "⭐", "🪐"] },
  party: { label: "Party", emoji: "🎉", sparkles: ["🎉", "🎊", "🥳", "🎈"] },
  pride: { label: "Pride", emoji: "🏳️‍🌈", sparkles: ["🏳️‍🌈", "🏳️‍⚧️", "❤️", "🧡", "💛", "💚", "💙", "💜"] },
  creepy: { label: "Creepy", emoji: "👻", sparkles: ["👻", "🎃", "🕷️", "💀"] },
  spring: { label: "Spring", emoji: "🌷", sparkles: ["🌷", "🌸", "🌼", "🦋"] },
  summer: { label: "Summer", emoji: "☀️", sparkles: ["☀️", "🌊", "🏖️", "🌴"] },
  winter: { label: "Winter", emoji: "❄️", sparkles: ["❄️", "⛄", "🌨️", "🧊"] },
  autumn: { label: "Autumn", emoji: "🍂", sparkles: ["🍂", "🍁", "🌾", "🎃"] },
};

export const SPARKLEFALL_DEFAULTS = {
  interval: 800,
  wind: 0,
  maxSparkles: 50,
  minSize: 10,
  maxSize: 30,
} as const;

export function isValidPreset(name: string): boolean {
  return name in SPARKLEFALL_PRESETS;
}

export function parseJsonArray(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
