import sharp from "sharp";

export interface ConversionResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

const CONVERTIBLE_TYPES = ["image/heic", "image/heif"];

export function isConvertibleImage(mimeType: string): boolean {
  return CONVERTIBLE_TYPES.includes(mimeType);
}

export async function convertToWebP(
  inputBuffer: Buffer
): Promise<ConversionResult> {
  const buffer = await sharp(inputBuffer).webp({ quality: 80 }).toBuffer();

  return {
    buffer,
    mimeType: "image/webp",
    extension: "webp",
  };
}
