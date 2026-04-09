import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
    moderationAction: { create: vi.fn() },
    contentViolation: { update: vi.fn() },
    appeal: { update: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendSuspensionEmail: vi.fn(),
  sendAppealResponseEmail: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendSuspensionEmail, sendAppealResponseEmail } from "@/lib/email";
import { suspendUser, unsuspendUser, reviewViolation, reviewAppeal } from "@/app/admin/actions";

const mockAuth = vi.mocked(auth);
const mockIsAdmin = vi.mocked(isAdmin);
const mockPrisma = vi.mocked(prisma);

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(entries)) {
    fd.set(key, val);
  }
  return fd;
}

describe("admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1" } } as never);
    mockIsAdmin.mockReturnValue(true);
  });

  describe("suspendUser", () => {
    it("suspends user and sends email", async () => {
      mockPrisma.user.update.mockResolvedValue({ email: "user@example.com" } as never);
      mockPrisma.moderationAction.create.mockResolvedValue({} as never);

      await suspendUser(makeFormData({ userId: "user-1", reason: "Spam" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          suspended: true,
          suspendedAt: expect.any(Date),
          suspensionReason: "Spam",
        },
        select: { email: true },
      });
      expect(mockPrisma.moderationAction.create).toHaveBeenCalledWith({
        data: {
          adminId: "admin-1",
          userId: "user-1",
          action: "suspend",
          reason: "Spam",
        },
      });
      expect(sendSuspensionEmail).toHaveBeenCalledWith({
        toEmail: "user@example.com",
        reason: "Spam",
      });
    });

    it("uses default reason when none provided", async () => {
      mockPrisma.user.update.mockResolvedValue({ email: null } as never);
      mockPrisma.moderationAction.create.mockResolvedValue({} as never);

      await suspendUser(makeFormData({ userId: "user-1", reason: "" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suspensionReason: "Violation of community guidelines",
          }),
        })
      );
    });

    it("rejects non-admin users", async () => {
      mockIsAdmin.mockReturnValue(false);
      await expect(suspendUser(makeFormData({ userId: "user-1" }))).rejects.toThrow("Unauthorized");
    });
  });

  describe("unsuspendUser", () => {
    it("clears suspension fields", async () => {
      mockPrisma.user.update.mockResolvedValue({} as never);
      mockPrisma.moderationAction.create.mockResolvedValue({} as never);

      await unsuspendUser(makeFormData({ userId: "user-1" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          suspended: false,
          suspendedAt: null,
          suspensionReason: null,
        },
      });
    });
  });

  describe("reviewViolation", () => {
    it("marks violation as reviewed", async () => {
      mockPrisma.contentViolation.update.mockResolvedValue({} as never);

      await reviewViolation(makeFormData({ violationId: "v-1" }));

      expect(mockPrisma.contentViolation.update).toHaveBeenCalledWith({
        where: { id: "v-1" },
        data: {
          action: "reviewed",
          reviewedAt: expect.any(Date),
        },
      });
    });
  });

  describe("reviewAppeal", () => {
    it("approves suspension appeal and unsuspends user", async () => {
      mockPrisma.appeal.update.mockResolvedValue({
        type: "suspension",
        userId: "user-2",
        user: { id: "user-2", email: "user2@example.com", contentWarnings: 1 },
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);
      mockPrisma.moderationAction.create.mockResolvedValue({} as never);

      await reviewAppeal(makeFormData({ appealId: "a-1", status: "approved", response: "Mistake" }));

      expect(mockPrisma.appeal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "a-1" },
          data: expect.objectContaining({ status: "approved", response: "Mistake" }),
        })
      );
      // Should unsuspend
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { suspended: false, suspendedAt: null, suspensionReason: null },
      });
      expect(sendAppealResponseEmail).toHaveBeenCalledWith({
        toEmail: "user2@example.com",
        status: "approved",
        response: "Mistake",
      });
    });

    it("denies appeal without unsuspending", async () => {
      mockPrisma.appeal.update.mockResolvedValue({
        type: "suspension",
        userId: "user-3",
        user: { id: "user-3", email: "user3@example.com", contentWarnings: 0 },
      } as never);

      await reviewAppeal(makeFormData({ appealId: "a-2", status: "denied", response: "Valid suspension" }));

      // Should NOT unsuspend
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(sendAppealResponseEmail).toHaveBeenCalledWith({
        toEmail: "user3@example.com",
        status: "denied",
        response: "Valid suspension",
      });
    });

    it("approves content warning appeal and decrements warnings", async () => {
      mockPrisma.appeal.update.mockResolvedValue({
        type: "content_warning",
        userId: "user-4",
        user: { id: "user-4", email: "user4@example.com", contentWarnings: 2 },
      } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      await reviewAppeal(makeFormData({ appealId: "a-3", status: "approved", response: "" }));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-4" },
        data: { contentWarnings: { decrement: 1 } },
      });
    });
  });
});
