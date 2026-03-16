import fs from "fs";
import path from "path";
import sharp from "sharp";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const THUMB_SIZE = 96; // 2x the 48px display size for retina
const THUMB_QUALITY = 75;

const bgDir = path.join(process.cwd(), "public", "backgrounds");
const thumbDir = path.join(bgDir, "thumbs");

async function main() {
  if (!fs.existsSync(bgDir)) {
    console.error("No public/backgrounds directory found");
    process.exit(1);
  }

  fs.mkdirSync(thumbDir, { recursive: true });

  const files = fs.readdirSync(bgDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext) && !fs.statSync(path.join(bgDir, f)).isDirectory();
  });

  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const id = path.parse(file).name;
    const srcPath = path.join(bgDir, file);
    const thumbPath = path.join(thumbDir, `${id}.webp`);

    // Skip if thumbnail is newer than source
    if (fs.existsSync(thumbPath)) {
      const srcStat = fs.statSync(srcPath);
      const thumbStat = fs.statSync(thumbPath);
      if (thumbStat.mtimeMs > srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    }

    try {
      await sharp(srcPath)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbPath);
      generated++;
      console.log(`  ✓ ${file} → thumbs/${id}.webp`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped (up to date)`);
}

main();
