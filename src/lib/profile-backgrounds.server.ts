import fs from "fs";
import path from "path";
import type { BackgroundDefinition, BgCategory } from "./profile-backgrounds";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"]);

const PATTERN_IDS = new Set([
  "bows-and-hearts",
  "checkered-pattern",
  "citrus-slices",
  "crown-pattern",
  "leopard-fur-pattern",
  "pattern-1",
  "pink-hearts",
  "red-stars-pattern",
  "rose-gold-hexagonal",
  "skulls-pattern",
  "smiley-faces",
  "spiderweb-pattern",
  "yellow-triangles",
]);

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
      .map((f) => {
        const id = path.parse(f).name;
        const thumbPath = path.join(bgDir, "thumbs", `${id}.webp`);
        const hasThumb = fs.existsSync(thumbPath);
        const category: BgCategory = PATTERN_IDS.has(id) ? "pattern" : "photo";
        return {
          id,
          name: fileNameToDisplayName(f),
          src: `/backgrounds/${f}`,
          thumbSrc: hasThumb ? `/backgrounds/thumbs/${id}.webp` : `/backgrounds/${f}`,
          category,
        };
      });
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
