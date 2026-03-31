import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { uploadLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getLimitsForTier, type UserTier } from "@/lib/limits";

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "application/pdf",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(uploadLimiter, session.user.id);
  if (rateLimited) return rateLimited;

  const tier = (session.user.tier as UserTier) ?? "free";
  const limits = getLimitsForTier(tier);

  const body = (await req.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      // clientPayload carries the file type category from the client
      const isVideo = clientPayload === "video";
      const maxSize = isVideo ? limits.maxVideoSize : limits.maxDocumentSize;

      return {
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: maxSize,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({
          userId: session.user!.id,
          category: clientPayload,
        }),
      };
    },
    onUploadCompleted: async () => {
      // Videos and documents don't need post-upload processing
    },
  });

  return NextResponse.json(jsonResponse);
}
