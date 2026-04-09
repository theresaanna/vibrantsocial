import { describe, it, expect, vi, beforeEach } from "vitest";

// Top-level mocks — these are hoisted
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quarantinedUpload: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ncmec-report", () => ({
  submitNCMECReport: vi.fn().mockResolvedValue({ reportId: 12345 }),
  isNCMECConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { submitNCMECReport, isNCMECConfigured } from "@/lib/ncmec-report";

const mockPrisma = vi.mocked(prisma);
const mockSubmitNCMEC = vi.mocked(submitNCMECReport);
const mockIsNCMECConfigured = vi.mocked(isNCMECConfigured);

// Dynamic import so env vars can be set before module loads
async function loadModule() {
  vi.resetModules();
  vi.mock("@/lib/prisma", () => ({
    prisma: {
      quarantinedUpload: {
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    },
  }));
  vi.mock("@/lib/ncmec-report", () => ({
    submitNCMECReport: vi.fn().mockResolvedValue({ reportId: 12345 }),
    isNCMECConfigured: vi.fn().mockReturnValue(false),
  }));
  vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));
  return import("@/lib/arachnid-shield");
}

describe("scanImageBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns safe: true when credentials are not configured", async () => {
    delete process.env.ARACHNID_SHIELD_USERNAME;
    delete process.env.ARACHNID_SHIELD_PASSWORD;

    const { scanImageBuffer } = await loadModule();
    const result = await scanImageBuffer(Buffer.from("fake"), "image/jpeg");

    expect(result.safe).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns safe: true when scan finds no match", async () => {
    process.env.ARACHNID_SHIELD_USERNAME = "user";
    process.env.ARACHNID_SHIELD_PASSWORD = "pass";

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        classification: "no-known-match",
        is_match: false,
        sha256_hex: "abc123",
        sha1_base32: "def456",
        match_type: null,
        size_bytes: 1024,
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { scanImageBuffer } = await loadModule();
    const result = await scanImageBuffer(Buffer.from("safe-image"), "image/png");

    expect(result.safe).toBe(true);
    expect(result.classification).toBe("no-known-match");
    expect(fetch).toHaveBeenCalledWith(
      "https://shield.projectarachnid.com/v1/media/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "image/png",
        }),
      })
    );
  });

  it("returns safe: false when scan detects CSAM", async () => {
    process.env.ARACHNID_SHIELD_USERNAME = "user";
    process.env.ARACHNID_SHIELD_PASSWORD = "pass";

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        classification: "csam",
        is_match: true,
        sha256_hex: "flagged-hash",
        sha1_base32: "xxx",
        match_type: "exact",
        size_bytes: 2048,
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { scanImageBuffer } = await loadModule();
    const result = await scanImageBuffer(Buffer.from("bad-image"), "image/jpeg");

    expect(result.safe).toBe(false);
    expect(result.classification).toBe("csam");
    expect(result.sha256).toBe("flagged-hash");
  });

  it("returns safe: false for harmful-abusive-material", async () => {
    process.env.ARACHNID_SHIELD_USERNAME = "user";
    process.env.ARACHNID_SHIELD_PASSWORD = "pass";

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        classification: "harmful-abusive-material",
        is_match: true,
        sha256_hex: "harmful-hash",
        sha1_base32: "yyy",
        match_type: "near",
        size_bytes: 3072,
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { scanImageBuffer } = await loadModule();
    const result = await scanImageBuffer(Buffer.from("harmful-image"), "image/webp");

    expect(result.safe).toBe(false);
    expect(result.classification).toBe("harmful-abusive-material");
  });

  it("throws on API error (fail closed)", async () => {
    process.env.ARACHNID_SHIELD_USERNAME = "user";
    process.env.ARACHNID_SHIELD_PASSWORD = "pass";

    const mockResponse = { ok: false, status: 500 };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { scanImageBuffer } = await loadModule();
    await expect(
      scanImageBuffer(Buffer.from("image"), "image/jpeg")
    ).rejects.toThrow("Arachnid Shield API error: 500");
  });

  it("sends correct Basic auth header", async () => {
    process.env.ARACHNID_SHIELD_USERNAME = "myuser";
    process.env.ARACHNID_SHIELD_PASSWORD = "mypass";

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        classification: "no-known-match",
        is_match: false,
        sha256_hex: "abc",
        sha1_base32: "def",
        match_type: null,
        size_bytes: 100,
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const { scanImageBuffer } = await loadModule();
    await scanImageBuffer(Buffer.from("test"), "image/jpeg");

    const expectedAuth = "Basic " + Buffer.from("myuser:mypass").toString("base64");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expectedAuth,
        }),
      })
    );
  });
});

describe("quarantineUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates quarantine record with request metadata", async () => {
    const { quarantineUpload } = await loadModule();
    const { prisma: freshPrisma } = await import("@/lib/prisma");

    vi.mocked(freshPrisma.quarantinedUpload.create).mockResolvedValue({
      id: "quarantine-1",
      createdAt: new Date("2026-01-01"),
    } as never);

    const mockRequest = new Request("http://localhost/api/upload", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0",
        referer: "http://localhost/feed",
      },
    });

    await quarantineUpload({
      userId: "user1",
      classification: "csam",
      sha256: "flagged-hash",
      fileName: "photo.jpg",
      fileSize: 2048,
      mimeType: "image/jpeg",
      uploadEndpoint: "/api/upload",
      request: mockRequest,
      imageBuffer: Buffer.from("fake-image"),
    });

    expect(freshPrisma.quarantinedUpload.create).toHaveBeenCalledWith({
      data: {
        userId: "user1",
        classification: "csam",
        sha256: "flagged-hash",
        fileName: "photo.jpg",
        fileSize: 2048,
        mimeType: "image/jpeg",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        referer: "http://localhost/feed",
        uploadEndpoint: "/api/upload",
      },
    });
  });

  it("handles missing request headers gracefully", async () => {
    const { quarantineUpload } = await loadModule();
    const { prisma: freshPrisma } = await import("@/lib/prisma");

    vi.mocked(freshPrisma.quarantinedUpload.create).mockResolvedValue({
      id: "quarantine-2",
      createdAt: new Date("2026-01-01"),
    } as never);

    const mockRequest = new Request("http://localhost/api/avatar");

    await quarantineUpload({
      userId: "user2",
      classification: "harmful-abusive-material",
      sha256: "some-hash",
      fileName: "avatar.png",
      fileSize: 1024,
      mimeType: "image/png",
      uploadEndpoint: "/api/avatar",
      request: mockRequest,
      imageBuffer: Buffer.from("fake-image"),
    });

    expect(freshPrisma.quarantinedUpload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: null,
        userAgent: null,
        referer: null,
      }),
    });
  });

  it("triggers NCMEC report when configured", async () => {
    const { quarantineUpload } = await loadModule();
    const { prisma: freshPrisma } = await import("@/lib/prisma");
    const ncmec = await import("@/lib/ncmec-report");

    vi.mocked(freshPrisma.quarantinedUpload.create).mockResolvedValue({
      id: "quarantine-3",
      createdAt: new Date("2026-01-01"),
    } as never);
    vi.mocked(freshPrisma.user.findUnique).mockResolvedValue({
      username: "testuser",
      email: "test@example.com",
    } as never);
    vi.mocked(ncmec.isNCMECConfigured).mockReturnValue(true);
    vi.mocked(ncmec.submitNCMECReport).mockResolvedValue({ reportId: 99999 });

    const mockRequest = new Request("http://localhost/api/upload", {
      headers: { "x-forwarded-for": "10.0.0.1", "user-agent": "TestAgent" },
    });

    await quarantineUpload({
      userId: "user3",
      classification: "csam",
      sha256: "abc123",
      fileName: "bad.jpg",
      fileSize: 5000,
      mimeType: "image/jpeg",
      uploadEndpoint: "/api/upload",
      request: mockRequest,
      imageBuffer: Buffer.from("image-data"),
    });

    // Allow the fire-and-forget promise to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(ncmec.submitNCMECReport).toHaveBeenCalledWith(
      expect.objectContaining({
        quarantinedUploadId: "quarantine-3",
        userId: "user3",
        username: "testuser",
        email: "test@example.com",
        classification: "csam",
        sha256: "abc123",
      })
    );
  });

  it("does not trigger NCMEC report when not configured", async () => {
    const { quarantineUpload } = await loadModule();
    const { prisma: freshPrisma } = await import("@/lib/prisma");
    const ncmec = await import("@/lib/ncmec-report");

    vi.mocked(freshPrisma.quarantinedUpload.create).mockResolvedValue({
      id: "quarantine-4",
      createdAt: new Date("2026-01-01"),
    } as never);
    vi.mocked(ncmec.isNCMECConfigured).mockReturnValue(false);

    const mockRequest = new Request("http://localhost/api/upload");

    await quarantineUpload({
      userId: "user4",
      classification: "csam",
      sha256: "xyz",
      fileName: "test.jpg",
      fileSize: 1000,
      mimeType: "image/jpeg",
      uploadEndpoint: "/api/upload",
      request: mockRequest,
      imageBuffer: Buffer.from("data"),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(ncmec.submitNCMECReport).not.toHaveBeenCalled();
  });
});
