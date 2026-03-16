import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

import { sendReportEmail } from "@/lib/email";

describe("sendReportEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-1" });

    await sendReportEmail({
      reporterUsername: "alice",
      reporterEmail: "alice@example.com",
      contentType: "post",
      contentId: "post-123",
      contentPreview: "This is a test post",
      description: "This post violates the TOS",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("vibrantsocial@proton.me");
    expect(call.subject).toContain("Content Report: post");
    expect(call.subject).toContain("post-123");
    expect(call.html).toContain("alice");
    expect(call.html).toContain("alice@example.com");
    expect(call.html).toContain("This is a test post");
    expect(call.html).toContain("This post violates the TOS");
  });

  it("sends email for comment reports", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-2" });

    await sendReportEmail({
      reporterUsername: "bob",
      reporterEmail: "bob@example.com",
      contentType: "comment",
      contentId: "comment-456",
      contentPreview: "A rude comment",
      description: "Harassment",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain("Content Report: comment");
    expect(call.html).toContain("comment-456");
    expect(call.html).toContain("Harassment");
  });

  it("sends email for profile reports", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-3" });

    await sendReportEmail({
      reporterUsername: "carol",
      reporterEmail: "carol@example.com",
      contentType: "profile",
      contentId: "user-789",
      contentPreview: "baduser",
      description: "Impersonation",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain("Content Report: profile");
    expect(call.html).toContain("baduser");
    expect(call.html).toContain("Impersonation");
  });

  it("escapes HTML in user-provided content", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-4" });

    await sendReportEmail({
      reporterUsername: '<script>alert("xss")</script>',
      reporterEmail: "xss@example.com",
      contentType: "post",
      contentId: "post-xss",
      contentPreview: '<img src=x onerror="alert(1)">',
      description: '<b>bold</b> description',
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
    expect(call.html).not.toContain('<img src=x');
    expect(call.html).toContain("&lt;img");
    expect(call.html).not.toContain("<b>bold</b>");
    expect(call.html).toContain("&lt;b&gt;");
  });

  it("captures exception to Sentry on email send failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendReportEmail({
        reporterUsername: "alice",
        reporterEmail: "alice@example.com",
        contentType: "post",
        contentId: "post-fail",
        contentPreview: "test",
        description: "test description",
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException.mock.calls[0][1]).toMatchObject({
      extra: {
        emailType: "report",
        contentType: "post",
        contentId: "post-fail",
        reporterUsername: "alice",
      },
    });
  });
});
