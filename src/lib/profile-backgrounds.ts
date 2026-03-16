import fs from "fs";
import path from "path";

export interface BackgroundDefinition {
  id: string;
  name: string;
  src: string;
}

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"]);

function fileNameToDisplayName(filename: string): string {
  const name = path.parse(filename).name;
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Scans the public/backgrounds directory and returns all image files
 * as background definitions. Server-only (uses fs).
 */
export function getProfileBackgrounds(): BackgroundDefinition[] {
  try {
    const bgDir = path.join(process.cwd(), "public", "backgrounds");
    const files = fs.readdirSync(bgDir);
    return files
      .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((f) => ({
        id: path.parse(f).name,
        name: fileNameToDisplayName(f),
        src: `/backgrounds/${f}`,
      }));
  } catch {
    return [];
  }
}

/**
 * Checks if a src path points to a file in the /backgrounds/ directory.
 * Works server-side by verifying the file exists on disk.
 */
export function isPresetBackgroundSrc(src: string): boolean {
  if (!src.startsWith("/backgrounds/")) return false;
  try {
    const filePath = path.join(process.cwd(), "public", src);
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export const VALID_BG_REPEAT = ["repeat", "repeat-x", "repeat-y", "no-repeat"] as const;
export const VALID_BG_ATTACHMENT = ["scroll", "fixed"] as const;
export const VALID_BG_SIZE = ["cover", "contain", "auto"] as const;
export const VALID_BG_POSITION = [
  "center", "top", "bottom", "left", "right",
  "top left", "top center", "top right",
  "center left", "center center", "center right",
  "bottom left", "bottom center", "bottom right",
] as const;

export type BgRepeat = (typeof VALID_BG_REPEAT)[number];
export type BgAttachment = (typeof VALID_BG_ATTACHMENT)[number];
export type BgSize = (typeof VALID_BG_SIZE)[number];
export type BgPosition = (typeof VALID_BG_POSITION)[number];

export function isValidBgRepeat(v: string): v is BgRepeat {
  return (VALID_BG_REPEAT as readonly string[]).includes(v);
}
export function isValidBgAttachment(v: string): v is BgAttachment {
  return (VALID_BG_ATTACHMENT as readonly string[]).includes(v);
}
export function isValidBgSize(v: string): v is BgSize {
  return (VALID_BG_SIZE as readonly string[]).includes(v);
}
export function isValidBgPosition(v: string): v is BgPosition {
  return (VALID_BG_POSITION as readonly string[]).includes(v);
}
