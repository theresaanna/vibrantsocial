import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";

const MAX_DIGITAL_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(uploadLimiter, session.user.id);
  if (rateLimited) return rateLimited;

  const body = (await req.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => {
      return {
        maximumSizeInBytes: MAX_DIGITAL_FILE_SIZE,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({
          userId: session.user!.id,
          category: "digital-file",
        }),
      };
    },
    onUploadCompleted: async () => {
      // No post-upload processing needed for digital files
    },
  });

  return NextResponse.json(jsonResponse);
}
