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

const MAX_IMAGE_DIMENSION = 1000;
const RESIZABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isResizableImage(mimeType: string): boolean {
  return RESIZABLE_TYPES.includes(mimeType);
}

export async function resizeImage(inputBuffer: Uint8Array): Promise<Uint8Array> {
  return sharp(inputBuffer)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();
}
