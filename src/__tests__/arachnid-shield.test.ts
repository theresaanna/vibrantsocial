import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quarantinedUpload: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

// We need to dynamically import so env vars can be set before module loads
async function loadModule() {
  // Clear module cache so env changes take effect
  vi.resetModules();
  vi.mock("@/lib/prisma", () => ({
    prisma: {
      quarantinedUpload: {
        create: vi.fn(),
      },
    },
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

    const mockRequest = new Request("http://localhost/api/upload", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0",
        referer: "http://localhost/feed",
      },
    });

    mockPrisma.quarantinedUpload.create.mockResolvedValue({} as never);

    await quarantineUpload({
      userId: "user1",
      classification: "csam",
      sha256: "flagged-hash",
      fileName: "photo.jpg",
      fileSize: 2048,
      mimeType: "image/jpeg",
      uploadEndpoint: "/api/upload",
      request: mockRequest,
    });

    expect(mockPrisma.quarantinedUpload.create).toHaveBeenCalledWith({
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

    const mockRequest = new Request("http://localhost/api/avatar");

    mockPrisma.quarantinedUpload.create.mockResolvedValue({} as never);

    await quarantineUpload({
      userId: "user2",
      classification: "harmful-abusive-material",
      sha256: "some-hash",
      fileName: "avatar.png",
      fileSize: 1024,
      mimeType: "image/png",
      uploadEndpoint: "/api/avatar",
      request: mockRequest,
    });

    expect(mockPrisma.quarantinedUpload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: null,
        userAgent: null,
        referer: null,
      }),
    });
  });
});
