import { prisma } from "@/lib/prisma";

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
  bytes: Buffer,
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
}

export async function quarantineUpload(params: QuarantineParams) {
  const { userId, classification, sha256, fileName, fileSize, mimeType, uploadEndpoint, request } = params;

  await prisma.quarantinedUpload.create({
    data: {
      userId,
      classification,
      sha256,
      fileName,
      fileSize,
      mimeType,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      uploadEndpoint,
    },
  });
}
