import fs from "fs";
import path from "path";
import type { BackgroundDefinition } from "./profile-backgrounds";

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
