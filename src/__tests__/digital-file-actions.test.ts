import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketplacePost: { findUnique: vi.fn() },
    digitalFile: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: null,
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import {
  attachDigitalFile,
  removeDigitalFile,
  regenerateCouponCode,
  redeemCouponAndDownload,
  downloadFreeFile,
  fetchDigitalFileInfo,
} from "@/app/marketplace/digital-file-actions";

const mockAuth = vi.mocked(auth);
const mockMarketplacePostFindUnique = vi.mocked(prisma.marketplacePost.findUnique);
const mockDigitalFileUpsert = vi.mocked(prisma.digitalFile.upsert);
const mockDigitalFileFindUnique = vi.mocked(prisma.digitalFile.findUnique);
const mockDigitalFileUpdate = vi.mocked(prisma.digitalFile.update);
const mockDigitalFileDeleteMany = vi.mocked(prisma.digitalFile.deleteMany);
const mockIsRateLimited = vi.mocked(isRateLimited);

describe("attachDigitalFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 1024, true);
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("rejects when rate limited", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockIsRateLimited.mockResolvedValueOnce(true);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 1024, true);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });

  it("rejects empty file URL", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await attachDigitalFile("mp-1", "", "file.zip", 1024, true);
    expect(result).toEqual({ success: false, message: "File URL and name are required" });
  });

  it("rejects empty file name", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "", 1024, true);
    expect(result).toEqual({ success: false, message: "File URL and name are required" });
  });

  it("rejects file size of 0", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 0, true);
    expect(result).toEqual({ success: false, message: "File must be between 1 byte and 200MB" });
  });

  it("rejects file exceeding 200MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 201 * 1024 * 1024, true);
    expect(result).toEqual({ success: false, message: "File must be between 1 byte and 200MB" });
  });

  it("rejects when marketplace post not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce(null);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 1024, true);
    expect(result).toEqual({ success: false, message: "Not authorized" });
  });

  it("rejects when user is not the post author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u2" },
    } as never);
    const result = await attachDigitalFile("mp-1", "https://example.com/file.zip", "file.zip", 1024, true);
    expect(result).toEqual({ success: false, message: "Not authorized" });
  });

  it("attaches a free digital file successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
    } as never);
    mockDigitalFileUpsert.mockResolvedValueOnce({} as never);

    const result = await attachDigitalFile("mp-1", "https://blob.example.com/file.zip", "file.zip", 1024, true);
    expect(result).toEqual({ success: true, message: "Digital file attached" });
    expect(mockDigitalFileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { marketplacePostId: "mp-1" },
        create: expect.objectContaining({
          isFree: true,
          couponCode: null,
          fileName: "file.zip",
        }),
      }),
    );
  });

  it("attaches a coupon-locked file with generated coupon code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
    } as never);
    mockDigitalFileUpsert.mockResolvedValueOnce({} as never);

    const result = await attachDigitalFile("mp-1", "https://blob.example.com/file.zip", "file.zip", 1024, false);
    expect(result).toEqual({ success: true, message: "Digital file attached" });
    expect(mockDigitalFileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isFree: false,
          couponCode: expect.stringMatching(/^[A-F0-9]{12}$/),
        }),
      }),
    );
  });
});

describe("removeDigitalFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await removeDigitalFile("mp-1");
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("rejects when user is not the author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u2" },
    } as never);
    const result = await removeDigitalFile("mp-1");
    expect(result).toEqual({ success: false, message: "Not authorized" });
  });

  it("removes digital file successfully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
    } as never);
    mockDigitalFileDeleteMany.mockResolvedValueOnce({ count: 1 } as never);

    const result = await removeDigitalFile("mp-1");
    expect(result).toEqual({ success: true, message: "Digital file removed" });
    expect(mockDigitalFileDeleteMany).toHaveBeenCalledWith({ where: { marketplacePostId: "mp-1" } });
  });
});

describe("regenerateCouponCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await regenerateCouponCode("mp-1");
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("rejects when no digital file attached", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
      digitalFile: null,
    } as never);
    const result = await regenerateCouponCode("mp-1");
    expect(result).toEqual({ success: false, message: "No digital file attached" });
  });

  it("rejects for free files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
      digitalFile: { isFree: true },
    } as never);
    const result = await regenerateCouponCode("mp-1");
    expect(result).toEqual({ success: false, message: "Free files do not use coupon codes" });
  });

  it("generates a new coupon code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockMarketplacePostFindUnique.mockResolvedValueOnce({
      id: "mp-1",
      post: { authorId: "u1" },
      digitalFile: { isFree: false },
    } as never);
    mockDigitalFileUpdate.mockResolvedValueOnce({} as never);

    const result = await regenerateCouponCode("mp-1");
    expect(result.success).toBe(true);
    expect(result.couponCode).toMatch(/^[A-F0-9]{12}$/);
  });
});

describe("redeemCouponAndDownload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await redeemCouponAndDownload("mp-1", "ABCDEF123456");
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("rejects empty coupon code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    const result = await redeemCouponAndDownload("mp-1", "");
    expect(result).toEqual({ success: false, message: "Coupon code is required" });
  });

  it("rejects when no digital file found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce(null);
    const result = await redeemCouponAndDownload("mp-1", "ABCDEF123456");
    expect(result).toEqual({ success: false, message: "No digital file found" });
  });

  it("rejects when file is free", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({ isFree: true } as never);
    const result = await redeemCouponAndDownload("mp-1", "ABCDEF123456");
    expect(result).toEqual({ success: false, message: "This file is free to download" });
  });

  it("rejects invalid coupon code", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({
      isFree: false,
      couponCode: "REALCODE123456",
    } as never);
    const result = await redeemCouponAndDownload("mp-1", "WRONGCODE");
    expect(result).toEqual({ success: false, message: "Invalid coupon code" });
  });

  it("redeems valid coupon and returns download URL", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({
      id: "df-1",
      isFree: false,
      couponCode: "ABCDEF123456",
      fileUrl: "https://blob.example.com/file.zip",
      fileName: "my-file.zip",
    } as never);
    mockDigitalFileUpdate.mockResolvedValueOnce({} as never);

    const result = await redeemCouponAndDownload("mp-1", "ABCDEF123456");
    expect(result).toEqual({
      success: true,
      message: "Coupon redeemed",
      downloadUrl: "https://blob.example.com/file.zip",
      fileName: "my-file.zip",
    });
    expect(mockDigitalFileUpdate).toHaveBeenCalledWith({
      where: { id: "df-1" },
      data: { downloadCount: { increment: 1 } },
    });
  });

  it("rejects when rate limited", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockIsRateLimited.mockResolvedValueOnce(true);
    const result = await redeemCouponAndDownload("mp-1", "ABCDEF123456");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many requests");
  });
});

describe("downloadFreeFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await downloadFreeFile("mp-1");
    expect(result).toEqual({ success: false, message: "Not authenticated" });
  });

  it("rejects when no digital file found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce(null);
    const result = await downloadFreeFile("mp-1");
    expect(result).toEqual({ success: false, message: "No digital file found" });
  });

  it("rejects when file is not free", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({ isFree: false } as never);
    const result = await downloadFreeFile("mp-1");
    expect(result).toEqual({ success: false, message: "This file requires a coupon code" });
  });

  it("returns download URL for free files", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({
      id: "df-1",
      isFree: true,
      fileUrl: "https://blob.example.com/free-file.pdf",
      fileName: "guide.pdf",
    } as never);
    mockDigitalFileUpdate.mockResolvedValueOnce({} as never);

    const result = await downloadFreeFile("mp-1");
    expect(result).toEqual({
      success: true,
      message: "Download ready",
      downloadUrl: "https://blob.example.com/free-file.pdf",
      fileName: "guide.pdf",
    });
    expect(mockDigitalFileUpdate).toHaveBeenCalledWith({
      where: { id: "df-1" },
      data: { downloadCount: { increment: 1 } },
    });
  });
});

describe("fetchDigitalFileInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns hasFile: false when no digital file exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce(null);
    const result = await fetchDigitalFileInfo("mp-1");
    expect(result).toEqual({ hasFile: false });
  });

  it("returns file info with coupon for owner", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({
      fileName: "file.zip",
      fileSize: 1024,
      isFree: false,
      couponCode: "SECRET123",
      downloadCount: 5,
      marketplacePost: { post: { authorId: "u1" } },
    } as never);

    const result = await fetchDigitalFileInfo("mp-1");
    expect(result).toEqual({
      hasFile: true,
      fileName: "file.zip",
      fileSize: 1024,
      isFree: false,
      couponCode: "SECRET123",
      downloadCount: 5,
      isOwner: true,
    });
  });

  it("hides coupon code from non-owners", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u2" } } as never);
    mockDigitalFileFindUnique.mockResolvedValueOnce({
      fileName: "file.zip",
      fileSize: 1024,
      isFree: false,
      couponCode: "SECRET123",
      downloadCount: 5,
      marketplacePost: { post: { authorId: "u1" } },
    } as never);

    const result = await fetchDigitalFileInfo("mp-1");
    expect(result).toEqual({
      hasFile: true,
      fileName: "file.zip",
      fileSize: 1024,
      isFree: false,
      couponCode: undefined,
      downloadCount: undefined,
      isOwner: false,
    });
  });
});
