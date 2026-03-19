import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { invalidate, cacheKeys } from "@/lib/cache";
import { checkAndExpirePremium } from "@/lib/premium";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(uploadLimiter, session.user.id);
  if (rateLimited) return rateLimited;

  // Only premium users can upload custom backgrounds
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true, profileBgImage: true, username: true },
  });

  const isPremium = await checkAndExpirePremium(session.user.id);
  if (!isPremium) {
    return NextResponse.json(
      { error: "Premium subscription required" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, GIF, WebP, or SVG" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // CSAM scan for bitmap images (skip SVG — not a bitmap format)
  if (file.type !== "image/svg+xml") {
    const scanResult = await scanImageBuffer(buffer, file.type);

    if (!scanResult.safe) {
      await quarantineUpload({
        userId: session.user.id,
        classification: scanResult.classification!,
        sha256: scanResult.sha256!,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadEndpoint: "/api/profile-background",
        request,
      });
      return NextResponse.json({ error: "Upload rejected" }, { status: 400 });
    }
  }

  const ext = file.type === "image/svg+xml"
    ? "svg"
    : file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `backgrounds/${session.user.id}-${Date.now()}.${ext}`;

  const blob = await put(filename, file, { access: "public" });

  // Delete old background if it's a Vercel Blob URL
  if (user?.profileBgImage?.includes("blob.vercel-storage.com")) {
    try {
      await del(user.profileBgImage);
    } catch {
      // Non-critical — old blob cleanup failed
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profileBgImage: blob.url },
  });

  if (user?.username) {
    await invalidate(cacheKeys.userProfile(user.username));
  }

  revalidatePath("/profile");
  return NextResponse.json({ url: blob.url });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profileBgImage: true, username: true },
  });

  if (user?.profileBgImage?.includes("blob.vercel-storage.com")) {
    try {
      await del(user.profileBgImage);
    } catch {
      // Non-critical
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      profileBgImage: null,
      profileBgRepeat: null,
      profileBgAttachment: null,
      profileBgSize: null,
      profileBgPosition: null,
    },
  });

  if (user?.username) {
    await invalidate(cacheKeys.userProfile(user.username));
  }

  revalidatePath("/profile");
  return NextResponse.json({ success: true });
}
