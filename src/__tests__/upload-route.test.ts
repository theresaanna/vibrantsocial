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

import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { POST } from "@/app/api/upload/route";

const mockAuth = vi.mocked(auth);
const mockPut = vi.mocked(put);
const mockScan = vi.mocked(scanImageBuffer);
const mockQuarantine = vi.mocked(quarantineUpload);

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

  it("rejects invalid file types", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("doc.pdf", "application/pdf", 100);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid file type");
  });

  it("rejects files exceeding size limit", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("too large");
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

  it("uploads successfully when scan passes", async () => {
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
});
