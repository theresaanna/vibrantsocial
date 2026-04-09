import { prisma } from "@/lib/prisma";
import { submitNCMECReport, isNCMECConfigured } from "@/lib/ncmec-report";
import * as Sentry from "@sentry/nextjs";

const ARACHNID_API_URL = "https://shield.projectarachnid.com/v1/media/";

interface ArachnidScanResponse {
  classification: string;
  is_match: boolean;
  sha256_hex: string;
  sha1_base32: string;
  match_type: string | null;
  size_bytes: number;
}

export interface ScanResult {
  safe: boolean;
  classification?: string;
  sha256?: string;
}

export async function scanImageBuffer(
  bytes: Buffer | Uint8Array,
  mimeType: string
): Promise<ScanResult> {
  const username = process.env.ARACHNID_SHIELD_USERNAME;
  const password = process.env.ARACHNID_SHIELD_PASSWORD;

  if (!username || !password) {
    console.warn(
      "Arachnid Shield credentials not configured — skipping scan"
    );
    return { safe: true };
  }

  const response = await fetch(ARACHNID_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    throw new Error(`Arachnid Shield API error: ${response.status}`);
  }

  const data: ArachnidScanResponse = await response.json();

  return {
    safe: !data.is_match,
    classification: data.classification,
    sha256: data.sha256_hex,
  };
}

export interface QuarantineParams {
  userId: string;
  classification: string;
  sha256: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadEndpoint: string;
  request: Request;
  imageBuffer: Buffer | Uint8Array;
}

export async function quarantineUpload(params: QuarantineParams) {
  const { userId, classification, sha256, fileName, fileSize, mimeType, uploadEndpoint, request, imageBuffer } = params;

  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  const record = await prisma.quarantinedUpload.create({
    data: {
      userId,
      classification,
      sha256,
      fileName,
      fileSize,
      mimeType,
      ipAddress,
      userAgent,
      referer: request.headers.get("referer"),
      uploadEndpoint,
    },
  });

  // Submit NCMEC CyberTipline report (fire-and-forget — don't block the response)
  if (isNCMECConfigured()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true },
    });

    submitNCMECReport({
      quarantinedUploadId: record.id,
      userId,
      username: user?.username ?? userId,
      email: user?.email ?? null,
      classification,
      sha256,
      fileName,
      fileSize,
      mimeType,
      ipAddress,
      userAgent,
      imageBuffer,
      incidentDateTime: record.createdAt,
    }).catch((error) => {
      console.error("NCMEC report submission failed:", error);
      Sentry.captureException(error, {
        extra: {
          quarantinedUploadId: record.id,
          userId,
          classification,
          sha256,
        },
      });
    });
  }
}
