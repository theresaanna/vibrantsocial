import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
    comment: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/email", () => ({
  sendReportEmail: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/email";
import { submitReport, type ReportState } from "@/app/report/actions";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockSendReportEmail = vi.mocked(sendReportEmail);

const prevState: ReportState = { success: false, message: "" };

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

describe("submitReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "123", description: "bad post" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("logged in");
  });

  it("returns error for invalid content type", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "invalid", contentId: "123", description: "bad" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid content type");
  });

  it("returns error for missing content ID", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "", description: "bad" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Missing content ID");
  });

  it("returns error for empty description", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "123", description: "   " })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("describe");
  });

  it("returns error for description over 2000 chars", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const result = await submitReport(
      prevState,
      makeFormData({
        contentType: "post",
        contentId: "123",
        description: "a".repeat(2001),
      })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("2000");
  });

  it("returns error if reporter account not found", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "123", description: "bad post" })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Could not find");
  });

  it("successfully submits a post report", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "reporter",
      email: "reporter@example.com",
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      content: "Some post content that is being reported",
    } as never);
    mockSendReportEmail.mockResolvedValueOnce(undefined);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "post-123", description: "Violates TOS" })
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("Thank you");
    expect(result.message).toContain("human");
    expect(mockSendReportEmail).toHaveBeenCalledWith({
      reporterUsername: "reporter",
      reporterEmail: "reporter@example.com",
      contentType: "post",
      contentId: "post-123",
      contentPreview: "Some post content that is being reported",
      description: "Violates TOS",
    });
  });

  it("successfully submits a comment report", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "reporter",
      email: "reporter@example.com",
    } as never);
    mockPrisma.comment.findUnique.mockResolvedValueOnce({
      content: "Rude comment text",
      postId: "post-456",
    } as never);
    mockSendReportEmail.mockResolvedValueOnce(undefined);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "comment", contentId: "comment-789", description: "Harassment" })
    );

    expect(result.success).toBe(true);
    expect(mockSendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "comment",
        contentId: "comment-789",
        contentPreview: "Rude comment text",
      })
    );
  });

  it("successfully submits a profile report", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    // Reporter lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "reporter",
      email: "reporter@example.com",
    } as never);
    // Reported user lookup
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "baduser",
      displayName: "Bad User",
    } as never);
    mockSendReportEmail.mockResolvedValueOnce(undefined);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "profile", contentId: "user-bad", description: "Impersonation" })
    );

    expect(result.success).toBe(true);
    expect(mockSendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "profile",
        contentPreview: "baduser",
      })
    );
  });

  it("truncates long post content preview to 200 chars", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "reporter",
      email: "reporter@example.com",
    } as never);
    const longContent = "x".repeat(500);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      content: longContent,
    } as never);
    mockSendReportEmail.mockResolvedValueOnce(undefined);

    await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "post-long", description: "Too long" })
    );

    const emailCall = mockSendReportEmail.mock.calls[0][0];
    expect(emailCall.contentPreview).toHaveLength(200);
  });

  it("handles missing post gracefully", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      username: "reporter",
      email: "reporter@example.com",
    } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce(null as never);
    mockSendReportEmail.mockResolvedValueOnce(undefined);

    const result = await submitReport(
      prevState,
      makeFormData({ contentType: "post", contentId: "deleted-post", description: "Gone" })
    );

    expect(result.success).toBe(true);
    expect(mockSendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contentPreview: "Post not found",
      })
    );
  });
});
