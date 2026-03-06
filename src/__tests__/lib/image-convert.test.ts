import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sharp", () => {
  const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from("converted-webp"));
  const mockWebp = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
  return {
    default: vi.fn().mockReturnValue({ webp: mockWebp }),
  };
});

import { isConvertibleImage, convertToWebP } from "@/lib/image-convert";
import sharp from "sharp";

const mockSharp = vi.mocked(sharp);

describe("isConvertibleImage", () => {
  it("returns true for image/heic", () => {
    expect(isConvertibleImage("image/heic")).toBe(true);
  });

  it("returns true for image/heif", () => {
    expect(isConvertibleImage("image/heif")).toBe(true);
  });

  it("returns false for image/jpeg", () => {
    expect(isConvertibleImage("image/jpeg")).toBe(false);
  });

  it("returns false for image/png", () => {
    expect(isConvertibleImage("image/png")).toBe(false);
  });

  it("returns false for video/mp4", () => {
    expect(isConvertibleImage("video/mp4")).toBe(false);
  });

  it("returns false for application/pdf", () => {
    expect(isConvertibleImage("application/pdf")).toBe(false);
  });
});

describe("convertToWebP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns webp mimeType and extension", async () => {
    const result = await convertToWebP(Buffer.from("fake-heic-data"));
    expect(result.mimeType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it("passes input buffer to sharp", async () => {
    const input = Buffer.from("test-input");
    await convertToWebP(input);
    expect(mockSharp).toHaveBeenCalledWith(input);
  });

  it("calls webp with quality 80", async () => {
    await convertToWebP(Buffer.from("test"));
    const sharpInstance = mockSharp.mock.results[0].value;
    expect(sharpInstance.webp).toHaveBeenCalledWith({ quality: 80 });
  });
});
