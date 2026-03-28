import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    phoneBlock: {
      findMany: vi.fn(),
    },
    block: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiLimiter: {},
  authLimiter: {},
  isRateLimited: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("@/lib/twilio", () => ({
  sendVerificationCode: vi.fn(),
  checkVerificationCode: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode, checkVerificationCode } from "@/lib/twilio";
import { revalidatePath } from "next/cache";
import { sendPhoneCode, verifyPhoneCode } from "@/app/verify-phone/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockSendCode = vi.mocked(sendVerificationCode);
const mockCheckCode = vi.mocked(checkVerificationCode);
const mockRevalidate = vi.mocked(revalidatePath);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { step: "input" as const, message: "", success: false };

describe("sendPhoneCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+1", localNumber: "5551234567" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
    expect(result.step).toBe("input");
  });

  it("returns error for invalid phone number (no country code digit)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // countryCode "+" with no digit after + means phoneNumber = "+",
    // which fails the regex ^\+[1-9]\d{1,14}$
    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+", localNumber: "" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Please enter a valid phone number");
    expect(result.step).toBe("input");
  });

  it("returns error for phone number starting with 0 after +", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // +0 prefix is invalid per the regex ^\+[1-9]\d{1,14}$
    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+0", localNumber: "1234567" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Please enter a valid phone number");
    expect(result.step).toBe("input");
  });

  it("strips non-digit characters from localNumber", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockSendCode.mockResolvedValueOnce({} as never);

    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+1", localNumber: "(555) 123-4567" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { phoneNumber: "+15551234567" },
    });
  });

  it("saves phone number and sends code on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockSendCode.mockResolvedValueOnce({} as never);

    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+1", localNumber: "5551234567" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Code sent!");
    expect(result.step).toBe("verify");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { phoneNumber: "+15551234567" },
    });
    expect(mockSendCode).toHaveBeenCalledWith("+15551234567");
  });

  it("returns error when twilio send fails", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockSendCode.mockRejectedValueOnce(new Error("Twilio error"));

    const result = await sendPhoneCode(
      prevState,
      makeFormData({ countryCode: "+1", localNumber: "5551234567" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Failed to send verification code. Please try again."
    );
    expect(result.step).toBe("input");
  });
});

describe("verifyPhoneCode", () => {
  beforeEach(() => vi.clearAllMocks());

  const verifyPrevState = {
    step: "verify" as const,
    message: "",
    success: false,
  };

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "1234" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
    expect(result.step).toBe("input");
  });

  it("returns error for invalid code format (too short)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "12" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Enter a valid code");
    expect(result.step).toBe("verify");
  });

  it("returns error for invalid code format (non-numeric)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "abcd" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Enter a valid code");
  });

  it("returns error when user has no phone number on file", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: null,
    } as never);

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "1234" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("No phone number on file");
    expect(result.step).toBe("input");
  });

  it("returns error when user not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "1234" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("No phone number on file");
    expect(result.step).toBe("input");
  });

  it("returns error when verification code is not approved", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: "+15551234567",
    } as never);
    mockCheckCode.mockResolvedValueOnce({
      status: "pending",
    } as never);

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "1234" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid or expired code");
    expect(result.step).toBe("verify");
  });

  it("returns error when twilio check throws", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: "+15551234567",
    } as never);
    mockCheckCode.mockRejectedValueOnce(new Error("Twilio error"));

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "1234" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Verification failed. Please try again.");
    expect(result.step).toBe("verify");
  });

  it("marks phone as verified on success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: "+15551234567",
    } as never);
    mockCheckCode.mockResolvedValueOnce({
      status: "approved",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.phoneBlock.findMany.mockResolvedValueOnce([] as never);

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "123456" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Phone verified!");
    expect(result.step).toBe("done");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { phoneVerified: expect.any(Date) },
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/profile");
  });

  it("auto-blocks user when phone number is phone-blocked by someone", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: "+15551234567",
    } as never);
    mockCheckCode.mockResolvedValueOnce({ status: "approved" } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.phoneBlock.findMany.mockResolvedValueOnce([
      { blockerId: "blocker1" },
      { blockerId: "blocker2" },
    ] as never);
    mockPrisma.block.createMany.mockResolvedValueOnce({ count: 2 } as never);

    const result = await verifyPhoneCode(
      verifyPrevState,
      makeFormData({ code: "123456" })
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.block.createMany).toHaveBeenCalledWith({
      data: [
        { blockerId: "blocker1", blockedId: "user1" },
        { blockerId: "blocker2", blockedId: "user1" },
      ],
      skipDuplicates: true,
    });
  });

  it("does not create blocks when no phone blocks exist", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user1",
      phoneNumber: "+15551234567",
    } as never);
    mockCheckCode.mockResolvedValueOnce({ status: "approved" } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);
    mockPrisma.phoneBlock.findMany.mockResolvedValueOnce([] as never);

    await verifyPhoneCode(verifyPrevState, makeFormData({ code: "123456" }));

    expect(mockPrisma.block.createMany).not.toHaveBeenCalled();
  });
});
