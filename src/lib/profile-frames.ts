export interface FrameDefinition {
  id: string;
  name: string;
  src: string;
  category: "spring" | "neon" | "decorative";
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
  { id: "decorative-1", name: "Frame 1", src: "/frames/frame1.svg", category: "decorative" },
  { id: "decorative-2", name: "Frame 2", src: "/frames/frame2.svg", category: "decorative" },
  { id: "decorative-3", name: "Frame 3", src: "/frames/frame3.svg", category: "decorative" },
  { id: "decorative-4", name: "Frame 4", src: "/frames/frame4.svg", category: "decorative" },
  { id: "decorative-5", name: "Frame 5", src: "/frames/frame5.svg", category: "decorative" },
];

const FRAME_MAP = new Map(PROFILE_FRAMES.map((f) => [f.id, f]));

export function getFrameById(id: string | null | undefined): FrameDefinition | null {
  if (!id) return null;
  return FRAME_MAP.get(id) ?? null;
}

export function isValidFrameId(id: string): boolean {
  return FRAME_MAP.has(id);
}
