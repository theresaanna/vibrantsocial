const MAX_VIDEO_DIMENSION = 1000;

// Load the UMD build of @ffmpeg/ffmpeg directly from public/,
// bypassing webpack (which can't handle its internal dynamic chunks).
async function loadFFmpegUMD(): Promise<typeof import("@ffmpeg/ffmpeg")> {
  if ((window as unknown as Record<string, unknown>).FFmpegWASM) {
    return (window as unknown as Record<string, unknown>).FFmpegWASM as typeof import("@ffmpeg/ffmpeg");
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/ffmpeg/ffmpeg.js";
    script.onload = () => {
      const mod = (window as unknown as Record<string, unknown>).FFmpegWASM as typeof import("@ffmpeg/ffmpeg");
      if (mod) resolve(mod);
      else reject(new Error("FFmpegWASM not found after script load"));
    };
    script.onerror = () => reject(new Error("Failed to load /ffmpeg/ffmpeg.js"));
    document.head.appendChild(script);
  });
}

async function fetchFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

type FFmpegInstance = InstanceType<(typeof import("@ffmpeg/ffmpeg"))["FFmpeg"]>;
let ffmpegInstance: FFmpegInstance | null = null;

async function getFFmpeg(): Promise<FFmpegInstance> {
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg } = await loadFFmpegUMD();

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: "/ffmpeg/ffmpeg-core.js",
    wasmURL: "/ffmpeg/ffmpeg-core.wasm",
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

    video.onloadeddata = () => {
      cleanup();
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 && h === 0) {
        resolve(true);
        return;
      }
      resolve(w > MAX_VIDEO_DIMENSION || h > MAX_VIDEO_DIMENSION);
    };
    video.onerror = () => {
      cleanup();
      resolve(true);
    };

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

  const inputName = `input.mp4`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const exitCode = await ffmpeg.exec([
    "-i", inputName,
    "-vf", `scale=${MAX_VIDEO_DIMENSION}:${MAX_VIDEO_DIMENSION}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputName,
  ]);

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    throw new Error(`ffmpeg exited with code ${exitCode}`);
  }

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  const outName = file.name.replace(/\.[^.]+$/, ".mp4");
  return new File([data as unknown as BlobPart], outName, { type: "video/mp4" });
}
