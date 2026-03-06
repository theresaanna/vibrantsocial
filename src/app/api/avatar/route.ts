import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, GIF, or WebP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 5MB" },
      { status: 400 }
    );
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `avatars/${session.user.id}-${Date.now()}.${ext}`;

  // Upload to Vercel Blob
  const blob = await put(filename, file, { access: "public" });

  // Delete old avatar if it's a Vercel Blob URL
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatar: true },
  });

  if (user?.avatar?.includes("blob.vercel-storage.com")) {
    try {
      await del(user.avatar);
    } catch {
      // Non-critical — old blob cleanup failed
    }
  }

  // Save new avatar URL to database
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: blob.url },
  });

  revalidatePath("/profile");
  return NextResponse.json({ url: blob.url });
}
