import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
}));

vi.mock("@/lib/arachnid-shield", () => ({
  scanImageBuffer: vi.fn(),
  quarantineUpload: vi.fn(),
}));

vi.mock("@/lib/image-convert", () => ({
  isConvertibleImage: vi.fn((type: string) =>
    ["image/heic", "image/heif"].includes(type)
  ),
  convertToWebP: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  uploadLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { convertToWebP } from "@/lib/image-convert";
import { POST } from "@/app/api/upload/route";

const mockAuth = vi.mocked(auth);
const mockPut = vi.mocked(put);
const mockScan = vi.mocked(scanImageBuffer);
const mockQuarantine = vi.mocked(quarantineUpload);
const mockConvert = vi.mocked(convertToWebP);

function createMockFile(name: string, type: string, sizeBytes: number) {
  const content = new Uint8Array(sizeBytes);
  return {
    name,
    type,
    size: sizeBytes,
    arrayBuffer: vi.fn().mockResolvedValue(content.buffer),
  } as unknown as File;
}

function createRequest(file?: File): Request {
  const mockFormData = { get: vi.fn().mockReturnValue(file ?? null) };

  return {
    formData: vi.fn().mockResolvedValue(mockFormData),
    headers: new Headers({
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "TestAgent",
    }),
  } as unknown as Request;
}

describe("POST /api/upload", () => {
  beforeEach(() => vi.clearAllMocks());

  /* ── Auth & basic validation ────────────────────── */

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
  });

  it("rejects when no file provided", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const res = await POST(createRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file provided");
  });

  it("rejects unsupported file types", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("archive.zip", "application/zip", 100);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid file type");
  });

  /* ── Standard image uploads ─────────────────────── */

  it("rejects images exceeding 5MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("too large");
    expect(body.error).toContain("5MB");
  });

  it("blocks upload and quarantines when scan detects CSAM", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockResolvedValueOnce({
      safe: false,
      classification: "csam",
      sha256: "flagged-hash",
    });
    mockQuarantine.mockResolvedValueOnce(undefined);

    const file = createMockFile("photo.jpg", "image/jpeg", 1024);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Upload rejected");
    expect(mockQuarantine).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        classification: "csam",
        sha256: "flagged-hash",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        uploadEndpoint: "/api/upload",
      })
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("uploads standard image successfully when scan passes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.jpg",
    } as never);

    const file = createMockFile("photo.jpg", "image/jpeg", 1024);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://blob.example.com/uploads/img.jpg");
    expect(body.fileType).toBe("image");
    expect(body.fileName).toBe("photo.jpg");
    expect(body.fileSize).toBe(1024);
    expect(mockQuarantine).not.toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
  });

  it("returns 500 when scan throws (fail closed)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockRejectedValueOnce(
      new Error("Arachnid Shield API error: 500")
    );

    const file = createMockFile("photo.jpg", "image/jpeg", 1024);

    await expect(POST(createRequest(file))).rejects.toThrow(
      "Arachnid Shield API error: 500"
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  /* ── HEIC/HEIF convertible image uploads ────────── */

  it("accepts and converts HEIC files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const convertedBuffer = Buffer.from("converted-webp");
    mockConvert.mockResolvedValueOnce({
      buffer: convertedBuffer,
      mimeType: "image/webp",
      extension: "webp",
    });
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.webp",
    } as never);

    const file = createMockFile("photo.heic", "image/heic", 2048);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://blob.example.com/uploads/img.webp");
    expect(body.fileType).toBe("image");
    expect(mockConvert).toHaveBeenCalled();
  });

  it("accepts and converts HEIF files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const convertedBuffer = Buffer.from("converted-webp");
    mockConvert.mockResolvedValueOnce({
      buffer: convertedBuffer,
      mimeType: "image/webp",
      extension: "webp",
    });
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.webp",
    } as never);

    const file = createMockFile("photo.heif", "image/heif", 2048);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    expect(mockConvert).toHaveBeenCalled();
    expect(mockScan).toHaveBeenCalled();
  });

  it("CSAM scans converted buffer (not original)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const convertedBuffer = Buffer.from("converted-webp-data");
    mockConvert.mockResolvedValueOnce({
      buffer: convertedBuffer,
      mimeType: "image/webp",
      extension: "webp",
    });
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.webp",
    } as never);

    const file = createMockFile("photo.heic", "image/heic", 2048);
    await POST(createRequest(file));

    // scanImageBuffer should be called with the converted buffer and webp mime type
    expect(mockScan).toHaveBeenCalledWith(convertedBuffer, "image/webp");
  });

  it("uploads converted buffer to blob storage", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const convertedBuffer = Buffer.from("converted-webp-data");
    mockConvert.mockResolvedValueOnce({
      buffer: convertedBuffer,
      mimeType: "image/webp",
      extension: "webp",
    });
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.webp",
    } as never);

    const file = createMockFile("photo.heic", "image/heic", 2048);
    await POST(createRequest(file));

    // put should receive the converted buffer, not the original file
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining(".webp"),
      convertedBuffer,
      expect.any(Object)
    );
  });

  it("rejects HEIC files exceeding 5MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("big.heic", "image/heic", 6 * 1024 * 1024);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("5MB");
  });

  /* ── Video uploads ──────────────────────────────── */

  it("accepts MP4 video uploads", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/clip.mp4",
    } as never);

    const file = createMockFile("clip.mp4", "video/mp4", 10 * 1024 * 1024);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileType).toBe("video");
    expect(body.fileName).toBe("clip.mp4");
  });

  it("accepts WebM video uploads", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/clip.webm",
    } as never);

    const file = createMockFile("clip.webm", "video/webm", 5000);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileType).toBe("video");
  });

  it("accepts MOV (QuickTime) video uploads", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/clip.mov",
    } as never);

    const file = createMockFile("clip.mov", "video/quicktime", 5000);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileType).toBe("video");
  });

  it("accepts OGG video uploads", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/clip.ogv",
    } as never);

    const file = createMockFile("clip.ogv", "video/ogg", 5000);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileType).toBe("video");
  });

  it("does not CSAM-scan video files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/clip.mp4",
    } as never);

    const file = createMockFile("clip.mp4", "video/mp4", 5000);
    await POST(createRequest(file));

    expect(mockScan).not.toHaveBeenCalled();
  });

  it("rejects videos exceeding 50MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile(
      "big.mp4",
      "video/mp4",
      51 * 1024 * 1024
    );
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("50MB");
  });

  /* ── PDF / document uploads ─────────────────────── */

  it("accepts PDF uploads", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/doc.pdf",
    } as never);

    const file = createMockFile("doc.pdf", "application/pdf", 2048);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileType).toBe("document");
    expect(body.fileName).toBe("doc.pdf");
    expect(body.fileSize).toBe(2048);
  });

  it("does not CSAM-scan PDF files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/doc.pdf",
    } as never);

    const file = createMockFile("doc.pdf", "application/pdf", 2048);
    await POST(createRequest(file));

    expect(mockScan).not.toHaveBeenCalled();
  });

  it("rejects PDFs exceeding 10MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile(
      "big.pdf",
      "application/pdf",
      11 * 1024 * 1024
    );
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("10MB");
  });

  /* ── Response shape ─────────────────────────────── */

  it("includes fileType, fileName, and fileSize in response", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/uploads/img.png",
    } as never);

    const file = createMockFile("screenshot.png", "image/png", 4096);
    const res = await POST(createRequest(file));

    const body = await res.json();
    expect(body).toEqual({
      url: "https://blob.example.com/uploads/img.png",
      fileType: "image",
      fileName: "screenshot.png",
      fileSize: 4096,
    });
  });
});
