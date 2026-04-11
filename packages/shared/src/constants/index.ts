import type { UserTier } from "../types";

// ── Tier limits ──────────────────────────────────────────────────────

export interface TierLimits {
  /** Max file sizes in bytes */
  maxImageSize: number;
  maxVideoSize: number;
  maxAudioSize: number;
  maxDocumentSize: number;
  /** Voice note max duration in seconds */
  maxVoiceNoteDuration: number;
}

const FREE_LIMITS: TierLimits = {
  maxImageSize: 5 * 1024 * 1024,
  maxVideoSize: 50 * 1024 * 1024,
  maxAudioSize: 10 * 1024 * 1024,
  maxDocumentSize: 10 * 1024 * 1024,
  maxVoiceNoteDuration: 20,
};

const PREMIUM_LIMITS: TierLimits = {
  maxImageSize: 20 * 1024 * 1024,
  maxVideoSize: 200 * 1024 * 1024,
  maxAudioSize: 50 * 1024 * 1024,
  maxDocumentSize: 50 * 1024 * 1024,
  maxVoiceNoteDuration: 120,
};

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: FREE_LIMITS,
  premium: PREMIUM_LIMITS,
};

export function getLimitsForTier(tier: UserTier = "free"): TierLimits {
  return TIER_LIMITS[tier];
}

export const DEFAULT_LIMITS = FREE_LIMITS;

export function formatSizeLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  return `${bytes / 1024}KB`;
}

export function getChatFileLimitsHint(limits: TierLimits = DEFAULT_LIMITS): string {
  return `Images ${formatSizeLimit(limits.maxImageSize)} · Videos ${formatSizeLimit(limits.maxVideoSize)} · Audio ${formatSizeLimit(limits.maxAudioSize)} · PDF ${formatSizeLimit(limits.maxDocumentSize)}`;
}

export function getEditorFileLimitsHint(limits: TierLimits = DEFAULT_LIMITS): string {
  return `Images ${formatSizeLimit(limits.maxImageSize)} · Videos ${formatSizeLimit(limits.maxVideoSize)} · PDF ${formatSizeLimit(limits.maxDocumentSize)}`;
}

// ── Profile fonts ────────────────────────────────────────────────────

export interface FontDefinition {
  id: string;
  name: string;
  googleFamily: string;
  tier: "free" | "premium";
}

export const USERNAME_FONTS: FontDefinition[] = [
  { id: "sofadi-one", name: "Sofadi One", googleFamily: "Sofadi+One", tier: "free" },
  { id: "jersey-10", name: "Jersey 10", googleFamily: "Jersey+10", tier: "free" },
  { id: "limelight", name: "Limelight", googleFamily: "Limelight", tier: "free" },
  { id: "unkempt", name: "Unkempt", googleFamily: "Unkempt", tier: "free" },
  { id: "gugi", name: "Gugi", googleFamily: "Gugi", tier: "premium" },
  { id: "turret-road", name: "Turret Road", googleFamily: "Turret+Road", tier: "premium" },
  { id: "nova-mono", name: "Nova Mono", googleFamily: "Nova+Mono", tier: "premium" },
  { id: "ewert", name: "Ewert", googleFamily: "Ewert", tier: "premium" },
  { id: "ballet", name: "Ballet", googleFamily: "Ballet", tier: "premium" },
  { id: "manufacturing-consent", name: "Manufacturing Consent", googleFamily: "Manufacturing+Consent", tier: "premium" },
  { id: "rubik-puddles", name: "Rubik Puddles", googleFamily: "Rubik+Puddles", tier: "premium" },
  { id: "hachi-maru-pop", name: "Hachi Maru Pop", googleFamily: "Hachi+Maru+Pop", tier: "premium" },
  { id: "ms-madi", name: "Ms Madi", googleFamily: "Ms+Madi", tier: "premium" },
  { id: "jacquard-24", name: "Jacquard 24", googleFamily: "Jacquard+24", tier: "premium" },
  { id: "texturina", name: "Texturina", googleFamily: "Texturina", tier: "premium" },
  { id: "great-vibes", name: "Great Vibes", googleFamily: "Great+Vibes", tier: "premium" },
  { id: "rye", name: "Rye", googleFamily: "Rye", tier: "premium" },
  { id: "bonbon", name: "Bonbon", googleFamily: "Bonbon", tier: "premium" },
  { id: "agu-display", name: "Agu Display", googleFamily: "Agu+Display", tier: "premium" },
  { id: "agbalumo", name: "Agbalumo", googleFamily: "Agbalumo", tier: "premium" },
];

const FONT_MAP = new Map(USERNAME_FONTS.map((f) => [f.id, f]));

export function getFontById(id: string | null | undefined): FontDefinition | null {
  if (!id) return null;
  return FONT_MAP.get(id) ?? null;
}

export function isValidFontId(id: string): boolean {
  return FONT_MAP.has(id);
}

export function getFontsForTier(tier: "free" | "premium"): FontDefinition[] {
  if (tier === "premium") return USERNAME_FONTS;
  return USERNAME_FONTS.filter((f) => f.tier === "free");
}

export function getGoogleFontUrl(font: FontDefinition): string {
  return `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
}

export function getGoogleFontsUrl(fonts: FontDefinition[]): string {
  const families = fonts.map((f) => `family=${f.googleFamily}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// ── Profile frames ───────────────────────────────────────────────────

export interface FrameDefinition {
  id: string;
  name: string;
  src: string;
  category: "spring" | "neon" | "decorative" | "floral" | "whimsy";
  scaleX?: number;
  scaleY?: number;
  frameScale?: number;
  offsetX?: number;
  offsetY?: number;
}

export const PROFILE_FRAMES: FrameDefinition[] = [
  { id: "spring-1", name: "Spring Bloom", src: "/frames/spring-1.svg", category: "spring" },
  { id: "spring-2", name: "Petal Ring", src: "/frames/spring-2.svg", category: "spring" },
  { id: "spring-3", name: "Garden Wreath", src: "/frames/spring-3.svg", category: "spring" },
  { id: "neon-1", name: "Neon Heart", src: "/frames/neon-1.svg", category: "neon" },
  { id: "neon-2", name: "Neon Glow", src: "/frames/neon-2.svg", category: "neon" },
  { id: "neon-3", name: "Neon Bloom", src: "/frames/neon-3.svg", category: "neon" },
  { id: "neon-4", name: "Neon Ring", src: "/frames/neon-4.svg", category: "neon" },
  { id: "neon-5", name: "Neon Flower", src: "/frames/neon-5.svg", category: "neon" },
  { id: "decorative-1", name: "Digital City", src: "/frames/frame1.svg", category: "decorative", scaleX: 1.15, scaleY: 0.92, offsetX: 3, offsetY: 3 },
  { id: "decorative-3", name: "Autumn Leaves", src: "/frames/frame3.svg", category: "decorative", scaleX: 1.18, scaleY: 0.9, offsetX: 1, offsetY: 1 },
  { id: "decorative-5", name: "Frisbee", src: "/frames/frame5.svg", category: "decorative", scaleX: 1.15, scaleY: 0.92 },
  { id: "decorative-12", name: "Lava", src: "/frames/frame12.svg", category: "decorative", offsetX: -5 },
  { id: "floral-1", name: "Cherry Blossom", src: "/frames/floral-1.png", category: "floral", scaleX: 1.12, scaleY: 0.93 },
  { id: "floral-3", name: "Red Rose", src: "/frames/floral-3.png", category: "floral", scaleX: 1.12, scaleY: 0.93 },
  { id: "floral-4", name: "Mint Bloom", src: "/frames/floral-4.png", category: "floral", scaleX: 1.14, scaleY: 0.91 },
  { id: "floral-5", name: "Frost Blossom", src: "/frames/floral-5.png", category: "floral", scaleX: 1.12, scaleY: 0.93, offsetX: -3 },
  { id: "floral-6", name: "Pink Peony", src: "/frames/floral-6.png", category: "floral", scaleX: 1.12, scaleY: 0.93 },
  { id: "whimsy-1", name: "Chocolate Strawberry", src: "/frames/whimsy-1.png", category: "whimsy", frameScale: 1.15, scaleX: 1.12, scaleY: 0.94 },
  { id: "whimsy-2", name: "Mushroom Wreath", src: "/frames/whimsy-2.png", category: "whimsy", frameScale: 1.15, scaleX: 1.12, scaleY: 0.92 },
  { id: "whimsy-3", name: "Skull Ring", src: "/frames/whimsy-3.png", category: "whimsy", frameScale: 1.05, scaleX: 0.92, scaleY: 1.08 },
  { id: "whimsy-4", name: "Woodland", src: "/frames/whimsy-4.png", category: "whimsy", frameScale: 1.15, scaleX: 1.10, scaleY: 0.94 },
  { id: "whimsy-5", name: "Celestial", src: "/frames/whimsy-5.png", category: "whimsy", frameScale: 1.15, scaleX: 1.10, scaleY: 0.94 },
  { id: "whimsy-6", name: "Moon Portal", src: "/frames/whimsy-6.png", category: "whimsy", frameScale: 1.15, scaleX: 1.10, scaleY: 0.94 },
  { id: "whimsy-7", name: "Mystic Mushroom", src: "/frames/whimsy-7.png", category: "whimsy", frameScale: 1.15, scaleX: 1.10, scaleY: 0.94 },
  { id: "whimsy-8", name: "Leaf Wreath", src: "/frames/whimsy-8.png", category: "whimsy", frameScale: 1.15, scaleX: 1.10, scaleY: 0.94 },
];

const FRAME_MAP = new Map(PROFILE_FRAMES.map((f) => [f.id, f]));

export function getFrameById(id: string | null | undefined): FrameDefinition | null {
  if (!id) return null;
  return FRAME_MAP.get(id) ?? null;
}

export function isValidFrameId(id: string): boolean {
  return FRAME_MAP.has(id);
}

// ── Sparklefall presets ──────────────────────────────────────────────

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
