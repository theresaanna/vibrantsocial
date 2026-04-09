import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendSupportEmail: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSupportEmail } from "@/lib/email";
import {
  submitSupportRequest,
  type SupportState,
} from "@/app/support/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockSendSupportEmail = vi.mocked(sendSupportEmail);
const prevState: SupportState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("submitSupportRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "Something broke" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("logged in");
  });

  it("returns error for invalid subject", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "invalid", body: "test" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("subject");
  });

  it("returns error for empty subject", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "", body: "test" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("subject");
  });

  it("returns error for empty body", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("describe");
  });

  it("returns error for whitespace-only body", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "   " })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("describe");
  });

  it("returns error for body over 5000 characters", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "a".repeat(5001) })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("5000");
  });

  it("returns error if user not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "Something broke" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("account");
  });

  it("returns error if user has no email", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: null,
    } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "Something broke" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("account");
  });

  it("sends support email and returns success", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: "test@example.com",
    } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "bug_report", body: "The feed won't load" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("sent");
    expect(mockSendSupportEmail).toHaveBeenCalledWith({
      username: "testuser",
      email: "test@example.com",
      subject: "bug_report",
      body: "The feed won't load",
    });
  });

  it("sends with all valid subject types", async () => {
    const subjects = [
      "bug_report",
      "appeal_content_warning",
      "abuse_report",
      "feature_request",
      "feedback",
      "other",
    ];

    for (const subject of subjects) {
      vi.clearAllMocks();
      mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        username: "testuser",
        email: "test@example.com",
      } as never);

      const result = await submitSupportRequest(
        prevState,
        makeFormData({ subject, body: "test message" })
      );

      expect(result.success).toBe(true);
      expect(mockSendSupportEmail).toHaveBeenCalledOnce();
    }
  });

  it("trims the body before validation", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "testuser",
      email: "test@example.com",
    } as never);

    const result = await submitSupportRequest(
      prevState,
      makeFormData({ subject: "feedback", body: "  trimmed message  " })
    );

    expect(result.success).toBe(true);
    expect(mockSendSupportEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: "trimmed message" })
    );
  });
});
