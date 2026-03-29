import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { isConvertibleImage, convertToWebP, isResizableImage, resizeImage } from "@/lib/image-convert";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getLimitsForTier, formatSizeLimit, type TierLimits, type UserTier } from "@/lib/limits";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const CONVERTIBLE_IMAGE_TYPES = ["image/heic", "image/heif"];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
];

const AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
];

const DOCUMENT_TYPES = ["application/pdf"];

type FileCategory = "image" | "convertible-image" | "video" | "audio" | "document";

function getFileCategory(mimeType: string): FileCategory | null {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (CONVERTIBLE_IMAGE_TYPES.includes(mimeType)) return "convertible-image";
  if (VIDEO_TYPES.includes(mimeType)) return "video";
  if (AUDIO_TYPES.includes(mimeType)) return "audio";
  if (DOCUMENT_TYPES.includes(mimeType)) return "document";
  return null;
}

function getMaxSize(category: FileCategory, limits: TierLimits): number {
  switch (category) {
    case "image":
    case "convertible-image":
      return limits.maxImageSize;
    case "video":
      return limits.maxVideoSize;
    case "audio":
      return limits.maxAudioSize;
    case "document":
      return limits.maxDocumentSize;
  }
}

function getSizeLimitLabel(category: FileCategory, limits: TierLimits): string {
  return formatSizeLimit(getMaxSize(category, limits));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(uploadLimiter, session.user.id);
  if (rateLimited) return rateLimited;

  const tier = (session.user.tier as UserTier) ?? "free";
  const limits = getLimitsForTier(tier);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Strip codec params (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const mimeType = file.type.split(";")[0].trim();
  const category = getFileCategory(mimeType);
  if (!category) {
    return NextResponse.json(
      {
        error:
          "Invalid file type. Supported: JPEG, PNG, GIF, WebP, HEIC, HEIF, MP4, WebM, MOV, OGG, MP3, PDF, Audio",
      },
      { status: 400 }
    );
  }

  const maxSize = getMaxSize(category, limits);
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${getSizeLimitLabel(category, limits)}` },
      { status: 400 }
    );
  }

  const arrayBuf = await file.arrayBuffer();
  let buffer = Buffer.from(new Uint8Array(arrayBuf));
  let ext = file.name.split(".").pop() ?? "bin";
  let converted = false;

  // CSAM scanning always happens first, on the original buffer
  if (category === "image" || category === "convertible-image") {
    const scanResult = await scanImageBuffer(buffer, mimeType);

    if (!scanResult.safe) {
      await quarantineUpload({
        userId: session.user.id,
        classification: scanResult.classification!,
        sha256: scanResult.sha256!,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadEndpoint: "/api/upload",
        request: req,
      });
      return NextResponse.json(
        { error: "Upload rejected" },
        { status: 400 }
      );
    }
  }

  // Convert HEIC/HEIF to WebP
  if (category === "convertible-image") {
    const result = await convertToWebP(buffer);
    buffer = Buffer.from(result.buffer);
    ext = result.extension;
    converted = true;
  }

  // Resize images to max 1000px in either dimension, preserving aspect ratio
  const resizableMimeType = converted ? "image/webp" : mimeType;
  if ((category === "image" || category === "convertible-image") && isResizableImage(resizableMimeType)) {
    buffer = Buffer.from(await resizeImage(buffer));
  }

  const filename = `uploads/${session.user.id}-${Date.now()}.${ext}`;

  const uploadBody = (category === "image" || category === "convertible-image") ? buffer : file;

  const blob = await put(filename, uploadBody, {
    access: "public",
    addRandomSuffix: false,
  });

  const fileType =
    category === "image" || category === "convertible-image"
      ? "image"
      : category === "video"
        ? "video"
        : category === "audio"
          ? "audio"
          : "document";

  return NextResponse.json({
    url: blob.url,
    fileType,
    fileName: file.name,
    fileSize: file.size,
  });
}
