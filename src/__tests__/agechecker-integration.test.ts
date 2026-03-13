import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ── Mocks ────────────────────────────────────────────────

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    comment: { count: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock global fetch for AgeChecker API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createVerification,
  getVerificationStatus,
  verifyWebhookSignature,
} from "@/lib/agechecker";
import {
  initiateAgeVerification,
  checkVerificationStatus,
} from "@/app/age-verify/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

// ── agechecker.ts lib tests ──────────────────────────────

describe("AgeChecker lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGECHECKER_API_KEY = "test_key";
    process.env.AGECHECKER_SECRET = "test_secret";
  });

  describe("createVerification", () => {
    it("sends correct request to AgeChecker API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            uuid: "ver_123",
            status: "accepted",
          }),
      });

      const result = await createVerification({
        first_name: "John",
        last_name: "Doe",
        dob_day: 15,
        dob_month: 6,
        dob_year: 1990,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.agechecker.net/v1/create",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );

      const body = JSON.parse(
        mockFetch.mock.calls[0][1].body as string
      );
      expect(body.key).toBe("test_key");
      expect(body.secret).toBe("test_secret");
      expect(body.data.first_name).toBe("John");
      expect(body.data.last_name).toBe("Doe");
      expect(body.options.min_age).toBe(18);

      expect(result.status).toBe("accepted");
      expect(result.uuid).toBe("ver_123");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { code: "invalid_token", message: "Bad token" },
          }),
      });

      await expect(
        createVerification({
          first_name: "John",
          last_name: "Doe",
          dob_day: 1,
          dob_month: 1,
          dob_year: 2010,
        })
      ).rejects.toThrow("Bad token");
    });

    it("throws when credentials are missing", async () => {
      delete process.env.AGECHECKER_API_KEY;

      await expect(
        createVerification({
          first_name: "John",
          last_name: "Doe",
          dob_day: 1,
          dob_month: 1,
          dob_year: 1990,
        })
      ).rejects.toThrow("AGECHECKER_API_KEY and AGECHECKER_SECRET must be set");
    });

    it("passes custom options (callback_url, metadata)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ uuid: "ver_456", status: "photo_id" }),
      });

      await createVerification(
        {
          first_name: "Jane",
          last_name: "Doe",
          dob_day: 10,
          dob_month: 3,
          dob_year: 1985,
        },
        {
          callback_url: "https://example.com/webhook",
          metadata: { userId: "u_abc" },
          customer_ip: "1.2.3.4",
        }
      );

      const body = JSON.parse(
        mockFetch.mock.calls[0][1].body as string
      );
      expect(body.options.callback_url).toBe(
        "https://example.com/webhook"
      );
      expect(body.options.metadata.userId).toBe("u_abc");
      expect(body.options.customer_ip).toBe("1.2.3.4");
    });
  });

  describe("getVerificationStatus", () => {
    it("fetches status for a UUID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ status: "pending" }),
      });

      const result = await getVerificationStatus("ver_789");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.agechecker.net/v1/status/ver_789",
        expect.objectContaining({
          headers: { "X-AgeChecker-Secret": "test_secret" },
        })
      );
      expect(result.status).toBe("pending");
    });

    it("returns denied status with reason", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ status: "denied", reason: "underage" }),
      });

      const result = await getVerificationStatus("ver_denied");
      expect(result.status).toBe("denied");
      expect(result.reason).toBe("underage");
    });
  });

  describe("verifyWebhookSignature", () => {
    it("returns true for valid signature", () => {
      const body = JSON.stringify({
        uuid: "ver_123",
        status: "accepted",
      });

      const hash = crypto
        .createHmac("sha1", "test_secret")
        .update(body)
        .digest("base64");

      expect(verifyWebhookSignature(body, hash)).toBe(true);
    });

    it("returns false for invalid signature", () => {
      const body = JSON.stringify({
        uuid: "ver_123",
        status: "accepted",
      });

      expect(verifyWebhookSignature(body, "invalid_sig")).toBe(false);
    });

    it("returns false when secret is not set", () => {
      delete process.env.AGECHECKER_SECRET;

      const body = JSON.stringify({ uuid: "ver_123" });
      expect(verifyWebhookSignature(body, "any")).toBe(false);
    });
  });
});

// ── Server action tests ──────────────────────────────────

describe("initiateAgeVerification action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGECHECKER_API_KEY = "test_key";
    process.env.AGECHECKER_SECRET = "test_secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const formData = new FormData();
    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns success if already verified", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: new Date(),
      dateOfBirth: new Date("1990-01-01"),
      email: "test@test.com",
    } as never);

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");

    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Already age verified");
  });

  it("requires first and last name", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      dateOfBirth: new Date("1990-01-01"),
      email: "test@test.com",
    } as never);

    const formData = new FormData();
    // No first/last name

    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("First and last name are required");
  });

  it("marks user as verified on instant acceptance", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      dateOfBirth: new Date("1990-06-15"),
      email: "john@example.com",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ uuid: "ver_instant", status: "accepted" }),
    });

    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("address", "123 Main St");
    formData.set("city", "Anytown");
    formData.set("state", "CA");
    formData.set("zip", "90210");

    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe("accepted");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user1" },
        data: expect.objectContaining({
          ageVerified: expect.any(Date),
          ageVerificationUuid: "ver_instant",
        }),
      })
    );
  });

  it("returns UUID when photo ID is required", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      dateOfBirth: new Date("1990-01-01"),
      email: "john@example.com",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ uuid: "ver_photo", status: "photo_id" }),
    });

    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");

    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(true);
    expect(result.uuid).toBe("ver_photo");
    expect(result.status).toBe("photo_id");

    // Should store the UUID for later webhook callbacks
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ageVerificationUuid: "ver_photo" },
      })
    );
  });

  it("handles not_created status (underage or blocked)", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      dateOfBirth: new Date("2010-01-01"),
      email: "test@test.com",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "not_created" }),
    });

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");

    const result = await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe("not_created");
  });

  it("sends callback_url using NEXT_PUBLIC_APP_URL", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      dateOfBirth: new Date("1990-01-01"),
      email: "john@example.com",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ uuid: "ver_cb", status: "accepted" }),
    });

    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");

    await initiateAgeVerification(
      { success: false, message: "" },
      formData
    );

    const body = JSON.parse(
      mockFetch.mock.calls[0][1].body as string
    );
    expect(body.options.callback_url).toBe(
      "https://example.com/api/agechecker-webhook"
    );
    expect(body.options.metadata.userId).toBe("user1");
  });
});

describe("checkVerificationStatus action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGECHECKER_SECRET = "test_secret";
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const result = await checkVerificationStatus();

    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("returns already verified if user is verified", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: new Date(),
      ageVerificationUuid: "ver_123",
    } as never);

    const result = await checkVerificationStatus();

    expect(result.success).toBe(true);
    expect(result.message).toBe("Already age verified");
  });

  it("returns error when no pending verification exists", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      ageVerificationUuid: null,
    } as never);

    const result = await checkVerificationStatus();

    expect(result.success).toBe(false);
    expect(result.message).toBe("No pending verification");
  });

  it("marks user as verified when status is accepted", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      ageVerificationUuid: "ver_pending",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "accepted" }),
    });

    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const result = await checkVerificationStatus();

    expect(result.success).toBe(true);
    expect(result.status).toBe("accepted");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user1" },
        data: { ageVerified: expect.any(Date) },
      })
    );
  });

  it("returns denied with reason", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      ageVerificationUuid: "ver_denied",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ status: "denied", reason: "underage" }),
    });

    const result = await checkVerificationStatus();

    expect(result.success).toBe(false);
    expect(result.status).toBe("denied");
    expect(result.message).toContain("underage");
  });

  it("returns pending status", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ageVerified: null,
      ageVerificationUuid: "ver_wait",
    } as never);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "pending" }),
    });

    const result = await checkVerificationStatus();

    expect(result.success).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.message).toBe("Verification is still pending");
    // Should NOT have called update
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
