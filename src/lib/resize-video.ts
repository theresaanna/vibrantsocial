const MAX_VIDEO_DIMENSION = 1000;

/**
 * Load a video file into an HTMLVideoElement and wait for dimensions.
 * Returns the video element with decoded first frame.
 */
function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);

    video.onloadeddata = () => {
      resolve(video);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cannot load video"));
    };

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load timed out"));
    }, 10_000);

    video.addEventListener("loadeddata", () => clearTimeout(timeout), { once: true });

    video.src = url;
    video.load();
  });
}

export async function videoNeedsResize(file: File): Promise<boolean> {
  try {
    const video = await loadVideo(file);
    URL.revokeObjectURL(video.src);
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 && h === 0) return true;
    return w > MAX_VIDEO_DIMENSION || h > MAX_VIDEO_DIMENSION;
  } catch {
    // Can't probe — skip resize rather than block upload
    return false;
  }
}

/**
 * Resize a video using Canvas + MediaRecorder (no WASM needed).
 * Draws each frame to a scaled canvas and records as WebM.
 */
export async function resizeVideo(file: File): Promise<File> {
  const video = await loadVideo(file);

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;

  // Calculate target dimensions (fit inside MAX x MAX, preserving aspect ratio)
  const scale = Math.min(MAX_VIDEO_DIMENSION / srcW, MAX_VIDEO_DIMENSION / srcH, 1);
  // Round to even numbers for codec compatibility
  const targetW = Math.round((srcW * scale) / 2) * 2;
  const targetH = Math.round((srcH * scale) / 2) * 2;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  // Set up MediaRecorder on canvas stream
  const stream = canvas.captureStream(30);

  // Attach audio track if the video has one
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination); // keep playback audible isn't needed, but connect for processing
    for (const track of dest.stream.getAudioTracks()) {
      stream.addTrack(track);
    }
  } catch {
    // No audio or AudioContext not supported — continue without audio
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
  });

  // Start recording and play the video
  recorder.start();
  video.currentTime = 0;
  await video.play();

  // Draw frames to canvas
  function drawFrame() {
    if (video.ended || video.paused) {
      recorder.stop();
      return;
    }
    ctx.drawImage(video, 0, 0, targetW, targetH);
    requestAnimationFrame(drawFrame);
  }
  drawFrame();

  // Wait for video to end
  await new Promise<void>((resolve) => {
    video.onended = () => resolve();
  });

  // Small delay to ensure last frames are captured
  await new Promise((r) => setTimeout(r, 100));
  if (recorder.state === "recording") {
    recorder.stop();
  }

  const blob = await recordingDone;

  // Clean up
  URL.revokeObjectURL(video.src);
  video.remove();

  const outName = file.name.replace(/\.[^.]+$/, ".webm");
  return new File([blob], outName, { type: "video/webm" });
}
