import os from "os";
import path from "path";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { scanImageBuffer, type ScanResult } from "@/lib/arachnid-shield";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeInstaller?.path) ffmpeg.setFfprobePath(ffprobeInstaller.path);

const DEFAULT_FRAME_COUNT = 5;
const FRAME_SIZE = "640x?";

async function extractFrames(videoBuffer: Buffer, count: number): Promise<Buffer[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vscan-"));
  const inputPath = path.join(tmpDir, "input");
  await fs.writeFile(inputPath, videoBuffer);

  // Evenly-spaced percentage timestamps (e.g. count=5 → 17%,33%,50%,67%,83%).
  const timestamps = Array.from(
    { length: count },
    (_, i) => `${Math.round(((i + 1) / (count + 1)) * 100)}%`
  );

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .on("end", () => resolve())
        .on("error", reject)
        .screenshots({
          timestamps,
          folder: tmpDir,
          filename: "frame-%i.png",
          size: FRAME_SIZE,
        });
    });

    const frames: Buffer[] = [];
    for (let i = 1; i <= count; i++) {
      const framePath = path.join(tmpDir, `frame-${i}.png`);
      try {
        frames.push(await fs.readFile(framePath));
      } catch {
        // Video may be shorter than expected — skip missing frames.
      }
    }
    return frames;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Scans a video buffer for CSAM by extracting evenly-spaced frames and running
 * each through Arachnid Shield. Returns the first flagged frame's result, or
 * { safe: true } if all frames pass (or scanning is not configured).
 */
export async function scanVideoForCSAM(videoBuffer: Buffer): Promise<ScanResult> {
  const frames = await extractFrames(videoBuffer, DEFAULT_FRAME_COUNT);
  if (frames.length === 0) {
    // No frames extracted — could not validate the video. Treat as unsafe
    // so we fail closed rather than waving through a video we can't inspect.
    return { safe: false, classification: "unscannable" };
  }
  for (const frame of frames) {
    const result = await scanImageBuffer(frame, "image/png");
    if (!result.safe) return result;
  }
  return { safe: true };
}
