import fs from "fs";
import path from "path";
import type { BackgroundDefinition, BgCategory } from "./profile-backgrounds";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"]);

const PATTERN_IDS = new Set([
  "bows-and-hearts",
  "checkered-pattern",
  "citrus-slices",
  "crown-pattern",
  "free-ouija-vector-background",
  "leopard-fur-pattern",
  "pattern-1",
  "pink-hearts",
  "red-stars-pattern",
  "rose-gold-hexagonal",
  "skulls-pattern",
  "smiley-faces",
  "spiderweb-pattern",
  "yellow-triangles",
  "90s-retro-pattern",
  "abstract-leopard",
  "blue-camo",
  "buffalo-plaid",
  "eucalyptus-leaves",
  "fish-scales",
  "forest-plants-snails",
  "grunge-texture",
  "pan-africa",
  "pastel-rainbow-dots",
  "pastel-strawberries",
  "red-hearts",
  "retro-monochrome",
  "shoe-pattern",
  "tropical-leaves",
  "vintage-background",
]);

/**
 * Premium backgrounds that are static/panoramic photos rather than tiling patterns.
 * These use photo defaults (no-repeat, cover, center) instead of pattern defaults.
 */
const PREMIUM_PHOTO_IDS = new Set([
  "palm-leaves-background-10-b-SH_generated",
  "RR-v-july-2020-2",
  "vecteezy_abstract-blue-geometric-background-with-triangle-shape_21571985-1",
]);

function fileNameToDisplayName(filename: string): string {
  const name = path.parse(filename).name;
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Scans a backgrounds directory and returns image files as background definitions.
 * Shared scanner used by both free and premium background loaders.
 */
function scanBackgroundDir(
  dirPath: string,
  urlPrefix: string,
  options?: { premiumOnly?: boolean },
): BackgroundDefinition[] {
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((f) => {
        const id = path.parse(f).name;
        const thumbPath = path.join(dirPath, "thumbs", `${id}.webp`);
        const hasThumb = fs.existsSync(thumbPath);
        const category: BgCategory = options?.premiumOnly
          ? PREMIUM_PHOTO_IDS.has(id) ? "photo" : "pattern"
          : PATTERN_IDS.has(id)
            ? "pattern"
            : "photo";
        return {
          id,
          name: fileNameToDisplayName(f),
          src: `${urlPrefix}/${f}`,
          thumbSrc: hasThumb ? `${urlPrefix}/thumbs/${id}.webp` : `${urlPrefix}/${f}`,
          category,
          ...(options?.premiumOnly ? { premiumOnly: true } : {}),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Returns all free (non-premium) preset backgrounds.
 */
export function getProfileBackgrounds(): BackgroundDefinition[] {
  const bgDir = path.join(process.cwd(), "public", "backgrounds");
  return scanBackgroundDir(bgDir, "/backgrounds");
}

/**
 * Returns premium-only preset backgrounds.
 */
export function getPremiumProfileBackgrounds(): BackgroundDefinition[] {
  const bgDir = path.join(process.cwd(), "public", "backgrounds", "premium");
  return scanBackgroundDir(bgDir, "/backgrounds/premium", { premiumOnly: true });
}

/**
 * Returns all preset backgrounds (free + premium).
 */
export function getAllProfileBackgrounds(): BackgroundDefinition[] {
  return [...getProfileBackgrounds(), ...getPremiumProfileBackgrounds()];
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

/**
 * Checks if a src path points to a premium-only background.
 */
export function isPremiumBackgroundSrc(src: string): boolean {
  return src.startsWith("/backgrounds/premium/") && isPresetBackgroundSrc(src);
}
