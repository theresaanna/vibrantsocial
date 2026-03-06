import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { isConvertibleImage, convertToWebP } from "@/lib/image-convert";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const CONVERTIBLE_IMAGE_TYPES = ["image/heic", "image/heif"];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
];

const DOCUMENT_TYPES = ["application/pdf"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

type FileCategory = "image" | "convertible-image" | "video" | "document";

function getFileCategory(mimeType: string): FileCategory | null {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (CONVERTIBLE_IMAGE_TYPES.includes(mimeType)) return "convertible-image";
  if (VIDEO_TYPES.includes(mimeType)) return "video";
  if (DOCUMENT_TYPES.includes(mimeType)) return "document";
  return null;
}

function getMaxSize(category: FileCategory): number {
  switch (category) {
    case "image":
    case "convertible-image":
      return MAX_IMAGE_SIZE;
    case "video":
      return MAX_VIDEO_SIZE;
    case "document":
      return MAX_DOCUMENT_SIZE;
  }
}

function getSizeLimitLabel(category: FileCategory): string {
  switch (category) {
    case "image":
    case "convertible-image":
      return "5MB";
    case "video":
      return "50MB";
    case "document":
      return "10MB";
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const category = getFileCategory(file.type);
  if (!category) {
    return NextResponse.json(
      {
        error:
          "Invalid file type. Supported: JPEG, PNG, GIF, WebP, SVG, HEIC, HEIF, MP4, WebM, MOV, OGG, PDF",
      },
      { status: 400 }
    );
  }

  const maxSize = getMaxSize(category);
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${getSizeLimitLabel(category)}` },
      { status: 400 }
    );
  }

  const arrayBuf = await file.arrayBuffer();
  let buffer: Buffer | Uint8Array = Buffer.from(new Uint8Array(arrayBuf));
  let ext = file.name.split(".").pop() ?? "bin";

  // Convert HEIC/HEIF to WebP
  if (category === "convertible-image") {
    const converted = await convertToWebP(buffer);
    buffer = converted.buffer;
    ext = converted.extension;
  }

  // CSAM scanning for all image types (standard + converted)
  if (category === "image" || category === "convertible-image") {
    const uploadMimeType =
      category === "convertible-image" ? "image/webp" : file.type;
    const scanResult = await scanImageBuffer(buffer, uploadMimeType);

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

  const filename = `uploads/${session.user.id}-${Date.now()}.${ext}`;

  const uploadBody = category === "convertible-image" ? buffer : file;

  const blob = await put(filename, uploadBody, {
    access: "public",
    addRandomSuffix: false,
  });

  const fileType =
    category === "image" || category === "convertible-image"
      ? "image"
      : category === "video"
        ? "video"
        : "document";

  return NextResponse.json({
    url: blob.url,
    fileType,
    fileName: file.name,
    fileSize: file.size,
  });
}
