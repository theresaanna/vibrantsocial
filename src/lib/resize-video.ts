import type { FFmpeg } from "@ffmpeg/ffmpeg";

const MAX_VIDEO_DIMENSION = 1000;
const FFMPEG_CORE_VERSION = "0.12.6";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function videoNeedsResize(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.videoWidth > MAX_VIDEO_DIMENSION || video.videoHeight > MAX_VIDEO_DIMENSION);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(false);
    };
    video.src = URL.createObjectURL(file);
  });
}

export async function resizeVideo(file: File): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const ext = file.name.split(".").pop() ?? "mp4";
  const inputName = `input.${ext}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    "-i", inputName,
    "-vf", `scale='min(${MAX_VIDEO_DIMENSION},iw)':'min(${MAX_VIDEO_DIMENSION},ih)':force_original_aspect_ratio=decrease`,
    "-c:v", "libx264",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const outName = file.name.replace(/\.[^.]+$/, ".mp4");
  return new File([data as unknown as BlobPart], outName, { type: "video/mp4" });
}
