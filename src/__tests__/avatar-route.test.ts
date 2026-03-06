import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/arachnid-shield", () => ({
  scanImageBuffer: vi.fn(),
  quarantineUpload: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { scanImageBuffer, quarantineUpload } from "@/lib/arachnid-shield";
import { POST } from "@/app/api/avatar/route";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
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

function createRequest(file?: File) {
  const mockFormData = { get: vi.fn().mockReturnValue(file ?? null) };

  return {
    formData: vi.fn().mockResolvedValue(mockFormData),
    headers: new Headers({
      "x-forwarded-for": "10.0.0.1",
      "user-agent": "TestAgent",
    }),
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/avatar", () => {
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
  });

  it("rejects files exceeding size limit", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const file = createMockFile("big.png", "image/png", 6 * 1024 * 1024);
    const res = await POST(createRequest(file));
    expect(res.status).toBe(400);
  });

  it("blocks upload and quarantines when scan detects CSAM", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockResolvedValueOnce({
      safe: false,
      classification: "csam",
      sha256: "bad-hash",
    });
    mockQuarantine.mockResolvedValueOnce(undefined);

    const file = createMockFile("avatar.jpg", "image/jpeg", 1024);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Upload rejected");
    expect(mockQuarantine).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        classification: "csam",
        sha256: "bad-hash",
        uploadEndpoint: "/api/avatar",
      })
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("uploads successfully when scan passes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockResolvedValueOnce({ safe: true });
    mockPut.mockResolvedValueOnce({
      url: "https://blob.example.com/avatars/u1.jpg",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ avatar: null } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const file = createMockFile("avatar.jpg", "image/jpeg", 1024);
    const res = await POST(createRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://blob.example.com/avatars/u1.jpg");
    expect(mockQuarantine).not.toHaveBeenCalled();
  });

  it("returns 500 when scan throws (fail closed)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockScan.mockRejectedValueOnce(
      new Error("Arachnid Shield API error: 503")
    );

    const file = createMockFile("avatar.jpg", "image/jpeg", 1024);

    await expect(POST(createRequest(file))).rejects.toThrow(
      "Arachnid Shield API error: 503"
    );
    expect(mockPut).not.toHaveBeenCalled();
  });
});
