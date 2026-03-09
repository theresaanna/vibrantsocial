import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { sendCommentEmail, sendNewChatEmail, sendWelcomeEmail, sendPasswordResetEmail, sendMentionEmail, sendEmailVerificationEmail } from "@/lib/email";

describe("sendCommentEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-1" });

    await sendCommentEmail({
      toEmail: "user@example.com",
      commenterName: "Alice",
      postId: "post-123",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("You got a new comment!");
    expect(call.html).toContain("Alice");
    expect(call.html).toContain("/post/post-123");
    expect(call.html).toContain("Hey, friend!");
  });

  it("escapes HTML in commenter name", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-2" });

    await sendCommentEmail({
      toEmail: "user@example.com",
      commenterName: '<script>alert("xss")</script>',
      postId: "post-123",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendCommentEmail({
        toEmail: "user@example.com",
        commenterName: "Alice",
        postId: "post-123",
      })
    ).resolves.toBeUndefined();
  });
});

describe("sendNewChatEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-3" });

    await sendNewChatEmail({
      toEmail: "bob@example.com",
      senderName: "Carol",
      conversationId: "conv-456",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("bob@example.com");
    expect(call.subject).toBe("You got a new message!");
    expect(call.html).toContain("Carol");
    expect(call.html).toContain("/chat/conv-456");
    expect(call.html).toContain("Hey, friend!");
  });

  it("escapes HTML in sender name", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-4" });

    await sendNewChatEmail({
      toEmail: "bob@example.com",
      senderName: "Bob <b>bold</b>",
      conversationId: "conv-456",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("<b>");
    expect(call.html).toContain("&lt;b&gt;");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendNewChatEmail({
        toEmail: "bob@example.com",
        senderName: "Carol",
        conversationId: "conv-456",
      })
    ).resolves.toBeUndefined();
  });
});

describe("sendWelcomeEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a welcome email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-5" });

    await sendWelcomeEmail("newuser@example.com");

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("newuser@example.com");
    expect(call.subject).toContain("Welcome to the party!");
    expect(call.html).toContain("Welcome to the party!");
    expect(call.html).toContain("No algorithms, no children, just self expression");
    expect(call.html).toContain("vibrantsocial@proton.me");
    expect(call.html).toContain("Theresa Anna");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(sendWelcomeEmail("newuser@example.com")).resolves.toBeUndefined();
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a reset email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-6" });

    await sendPasswordResetEmail({
      toEmail: "user@example.com",
      token: "test-token-uuid",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("Reset your password");
    expect(call.html).toContain("Reset your password");
    expect(call.html).toContain("/reset-password?token=test-token-uuid");
    expect(call.html).toContain("1 hour");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendPasswordResetEmail({
        toEmail: "user@example.com",
        token: "test-token-uuid",
      })
    ).resolves.toBeUndefined();
  });
});

describe("sendEmailVerificationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a verification email with the correct fields", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-10" });

    await sendEmailVerificationEmail({
      toEmail: "user@example.com",
      token: "test-verify-token",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("Verify your email address");
    expect(call.html).toContain("Verify your email address");
    expect(call.html).toContain("Verify Email");
  });

  it("contains verification URL with token and email", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-11" });

    await sendEmailVerificationEmail({
      toEmail: "user@example.com",
      token: "test-verify-token",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("/verify-email?token=test-verify-token");
    expect(call.html).toContain("email=user%40example.com");
  });

  it("contains 1 hour expiry note", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-12" });

    await sendEmailVerificationEmail({
      toEmail: "user@example.com",
      token: "test-verify-token",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("1 hour");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendEmailVerificationEmail({
        toEmail: "user@example.com",
        token: "test-verify-token",
      })
    ).resolves.toBeUndefined();
  });
});

describe("sendMentionEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a mention email for a post mention", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-7" });

    await sendMentionEmail({
      toEmail: "mentioned@example.com",
      mentionerName: "Alice",
      postId: "post-456",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("VibrantSocial <hello@vibrantsocial.app>");
    expect(call.to).toBe("mentioned@example.com");
    expect(call.subject).toBe("Someone mentioned you!");
    expect(call.html).toContain("Alice");
    expect(call.html).toContain("mentioned you in a post");
    expect(call.html).toContain("/post/post-456");
    expect(call.html).not.toContain("commentId");
    expect(call.html).toContain("View Post");
    expect(call.html).toContain("Hey, friend!");
  });

  it("sends a mention email for a comment mention with commentId in URL", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-8" });

    await sendMentionEmail({
      toEmail: "mentioned@example.com",
      mentionerName: "Bob",
      postId: "post-789",
      commentId: "comment-321",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("Bob");
    expect(call.html).toContain("mentioned you in a comment");
    expect(call.html).toContain("/post/post-789?commentId=comment-321");
    expect(call.html).toContain("View Comment");
  });

  it("escapes HTML in mentioner name", async () => {
    mockSend.mockResolvedValueOnce({ id: "email-9" });

    await sendMentionEmail({
      toEmail: "mentioned@example.com",
      mentionerName: '<img src=x onerror=alert(1)>',
      postId: "post-123",
    });

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("<img");
    expect(call.html).toContain("&lt;img");
  });

  it("does not throw on Resend failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Resend down"));

    await expect(
      sendMentionEmail({
        toEmail: "mentioned@example.com",
        mentionerName: "Alice",
        postId: "post-456",
      })
    ).resolves.toBeUndefined();
  });
});
