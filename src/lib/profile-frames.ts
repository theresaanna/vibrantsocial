export interface FrameDefinition {
  id: string;
  name: string;
  src: string;
  category: "spring" | "neon" | "decorative" | "floral" | "whimsy";
  /** Horizontal stretch to make oval frames rounder (default 1) */
  scaleX?: number;
  /** Vertical compression to make oval frames rounder (default 1) */
  scaleY?: number;
  /** Custom frame scale override (default uses FRAME_SCALE) */
  frameScale?: number;
  /** Horizontal offset in percent to reposition the frame (default 0) */
  offsetX?: number;
  /** Vertical offset in percent to reposition the frame (default 0) */
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
  { id: "decorative-10", name: "Flames", src: "/frames/frame10.svg", category: "decorative", frameScale: 1.8, scaleX: 1.22, scaleY: 0.90, offsetX: 10, offsetY: 2 },
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
