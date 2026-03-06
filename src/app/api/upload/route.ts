import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Supported: JPEG, PNG, GIF, WebP, SVG" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5MB" },
      { status: 400 }
    );
  }

  // Scan for CSAM before storing
  const buffer = Buffer.from(await file.arrayBuffer());
  const scanResult = await scanImageBuffer(buffer, file.type);

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
    return NextResponse.json({ error: "Upload rejected" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `uploads/${session.user.id}-${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({ url: blob.url });
}
