import type { FFmpeg } from "@ffmpeg/ffmpeg";

const MAX_VIDEO_DIMENSION = 1000;

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function videoNeedsResize(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;

    const cleanup = () => URL.revokeObjectURL(video.src);

    // Use loadeddata instead of loadedmetadata — some browsers don't
    // populate videoWidth/videoHeight until the first frame is decoded.
    video.onloadeddata = () => {
      cleanup();
      const w = video.videoWidth;
      const h = video.videoHeight;
      // If dimensions are still 0 (unsupported codec), default to resizing
      if (w === 0 && h === 0) {
        resolve(true);
        return;
      }
      resolve(w > MAX_VIDEO_DIMENSION || h > MAX_VIDEO_DIMENSION);
    };
    video.onerror = () => {
      cleanup();
      // Can't probe dimensions — attempt resize anyway, ffmpeg may still handle it
      resolve(true);
    };

    // Timeout: if neither event fires within 5s, assume resize is needed
    setTimeout(() => {
      cleanup();
      resolve(true);
    }, 5000);

    video.src = URL.createObjectURL(file);
    video.load();
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
    "-vf", `scale='min(${MAX_VIDEO_DIMENSION},iw)':'min(${MAX_VIDEO_DIMENSION},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
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
