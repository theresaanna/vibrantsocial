import sharp from "sharp";

export interface ConversionResult {
  buffer: Uint8Array;
  mimeType: string;
  extension: string;
}

const CONVERTIBLE_TYPES = ["image/heic", "image/heif"];

export function isConvertibleImage(mimeType: string): boolean {
  return CONVERTIBLE_TYPES.includes(mimeType);
}

export async function convertToWebP(
  inputBuffer: Uint8Array
): Promise<ConversionResult> {
  const buffer: Uint8Array = await sharp(inputBuffer).webp({ quality: 80 }).toBuffer();

  return {
    buffer,
    mimeType: "image/webp",
    extension: "webp",
  };
}
