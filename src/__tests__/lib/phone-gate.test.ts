import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";

const mockPrisma = vi.mocked(prisma);

describe("requirePhoneVerification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when user has verified phone", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      phoneVerified: new Date("2024-01-01"),
    } as never);

    const result = await requirePhoneVerification("user1");
    expect(result).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user1" },
      select: { phoneVerified: true },
    });
  });

  it("returns false when user has not verified phone", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      phoneVerified: null,
    } as never);

    const result = await requirePhoneVerification("user1");
    expect(result).toBe(false);
  });

  it("returns false when user is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await requirePhoneVerification("nonexistent");
    expect(result).toBe(false);
  });
});
