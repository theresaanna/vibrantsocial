import { describe, it, expect } from "vitest";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  sendMessageSchema,
  editMessageSchema,
  createGroupSchema,
  toggleReactionSchema,
  searchQuerySchema,
  wallPostStatusSchema,
  pushUnsubscribeSchema,
  cuidSchema,
  turnstileTokenSchema,
  parseFormData,
} from "@/lib/validations";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

describe("cuidSchema", () => {
  it("accepts non-empty strings", () => {
    expect(cuidSchema.safeParse("abc123").success).toBe(true);
  });

  it("rejects empty strings", () => {
    const result = cuidSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("turnstileTokenSchema", () => {
  it("accepts non-empty strings", () => {
    expect(turnstileTokenSchema.safeParse("token-abc").success).toBe(true);
  });

  it("rejects empty strings with CAPTCHA message", () => {
    const result = turnstileTokenSchema.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("CAPTCHA");
    }
  });
});

// ---------------------------------------------------------------------------
// signupSchema
// ---------------------------------------------------------------------------

describe("signupSchema", () => {
  const validData = {
    email: "Test@Example.COM",
    username: "TestUser_1",
    dateOfBirth: "2000-01-15",
    password: "password123",
    confirmPassword: "password123",
    agreeToTos: "true" as const,
    referralCode: "",
    "cf-turnstile-response": "",
  };

  it("accepts valid signup data", () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase and trimmed", () => {
    const result = signupSchema.safeParse(validData);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("normalizes username to lowercase", () => {
    const result = signupSchema.safeParse(validData);
    if (result.success) {
      expect(result.data.username).toBe("testuser_1");
    }
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({ ...validData, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = signupSchema.safeParse({ ...validData, username: "user!@#" });
    expect(result.success).toBe(false);
  });

  it("rejects username with spaces", () => {
    const result = signupSchema.safeParse({ ...validData, username: "user name" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = signupSchema.safeParse({ ...validData, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 30 characters", () => {
    const result = signupSchema.safeParse({
      ...validData,
      username: "a".repeat(31),
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({
      ...validData,
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Passwords do not match");
    }
  });

  it("rejects missing ToS agreement", () => {
    const result = signupSchema.safeParse({
      ...validData,
      agreeToTos: "false",
    });
    expect(result.success).toBe(false);
  });

  it("rejects underage users (under 18)", () => {
    const now = new Date();
    const underageDate = new Date(
      now.getFullYear() - 15,
      now.getMonth(),
      now.getDate()
    );
    const result = signupSchema.safeParse({
      ...validData,
      dateOfBirth: underageDate.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("You must be at least 18 years old to sign up");
    }
  });

  it("accepts users exactly 18 years old", () => {
    const now = new Date();
    const eighteenthBirthday = new Date(
      now.getFullYear() - 18,
      now.getMonth(),
      now.getDate()
    );
    const result = signupSchema.safeParse({
      ...validData,
      dateOfBirth: eighteenthBirthday.toISOString().split("T")[0],
    });
    expect(result.success).toBe(true);
  });

  it("rejects future date of birth", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = signupSchema.safeParse({
      ...validData,
      dateOfBirth: future.toISOString().split("T")[0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date string", () => {
    const result = signupSchema.safeParse({
      ...validData,
      dateOfBirth: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty referral code", () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts username with underscores", () => {
    const result = signupSchema.safeParse({
      ...validData,
      username: "my_user_name",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = loginSchema.safeParse({
      email: "USER@Example.COM",
      password: "password",
    });
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendMessageSchema
// ---------------------------------------------------------------------------

describe("sendMessageSchema", () => {
  it("accepts message with content", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conv-1",
      content: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("accepts message with media only (empty content)", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conv-1",
      content: "",
      mediaUrl: "https://example.com/img.png",
      mediaType: "image",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message without media", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conv-1",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message over 5000 characters", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conv-1",
      content: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty conversation ID", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid media type", () => {
    const result = sendMessageSchema.safeParse({
      conversationId: "conv-1",
      content: "Hello",
      mediaType: "executable",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// editMessageSchema
// ---------------------------------------------------------------------------

describe("editMessageSchema", () => {
  it("accepts valid edit", () => {
    const result = editMessageSchema.safeParse({
      messageId: "msg-1",
      content: "Updated",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = editMessageSchema.safeParse({
      messageId: "msg-1",
      content: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects content over 5000 chars", () => {
    const result = editMessageSchema.safeParse({
      messageId: "msg-1",
      content: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createGroupSchema
// ---------------------------------------------------------------------------

describe("createGroupSchema", () => {
  it("accepts valid group", () => {
    const result = createGroupSchema.safeParse({
      name: "My Group",
      participantIds: ["u1", "u2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty group name", () => {
    const result = createGroupSchema.safeParse({
      name: "",
      participantIds: ["u1", "u2"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects group name over 100 chars", () => {
    const result = createGroupSchema.safeParse({
      name: "a".repeat(101),
      participantIds: ["u1", "u2"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 participants", () => {
    const result = createGroupSchema.safeParse({
      name: "Group",
      participantIds: ["u1"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 participants", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `u${i}`);
    const result = createGroupSchema.safeParse({
      name: "Group",
      participantIds: ids,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleReactionSchema
// ---------------------------------------------------------------------------

describe("toggleReactionSchema", () => {
  it("accepts valid reaction", () => {
    expect(
      toggleReactionSchema.safeParse({ messageId: "m1", emoji: "👍" }).success
    ).toBe(true);
  });

  it("rejects empty emoji", () => {
    expect(
      toggleReactionSchema.safeParse({ messageId: "m1", emoji: "" }).success
    ).toBe(false);
  });

  it("rejects emoji over 10 chars", () => {
    expect(
      toggleReactionSchema.safeParse({
        messageId: "m1",
        emoji: "a".repeat(11),
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchQuerySchema
// ---------------------------------------------------------------------------

describe("searchQuerySchema", () => {
  it("accepts valid query", () => {
    expect(searchQuerySchema.safeParse({ query: "test" }).success).toBe(true);
  });

  it("rejects query shorter than 2 chars", () => {
    expect(searchQuerySchema.safeParse({ query: "a" }).success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = searchQuerySchema.safeParse({ query: "  ab  " });
    if (result.success) {
      expect(result.data.query).toBe("ab");
    }
  });
});

// ---------------------------------------------------------------------------
// wallPostStatusSchema
// ---------------------------------------------------------------------------

describe("wallPostStatusSchema", () => {
  it("accepts accepted status", () => {
    expect(
      wallPostStatusSchema.safeParse({
        wallPostId: "wp-1",
        status: "accepted",
      }).success
    ).toBe(true);
  });

  it("accepts hidden status", () => {
    expect(
      wallPostStatusSchema.safeParse({
        wallPostId: "wp-1",
        status: "hidden",
      }).success
    ).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      wallPostStatusSchema.safeParse({
        wallPostId: "wp-1",
        status: "deleted",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pushUnsubscribeSchema
// ---------------------------------------------------------------------------

describe("pushUnsubscribeSchema", () => {
  it("accepts valid URL endpoint", () => {
    expect(
      pushUnsubscribeSchema.safeParse({
        endpoint: "https://push.example.com/sub/123",
      }).success
    ).toBe(true);
  });

  it("rejects non-URL endpoint", () => {
    expect(
      pushUnsubscribeSchema.safeParse({ endpoint: "not-a-url" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseFormData
// ---------------------------------------------------------------------------

describe("parseFormData", () => {
  const testSchema = z.object({
    name: z.string().min(1, "Name required"),
    age: z.string().optional(),
  });

  it("parses valid form data", () => {
    const fd = new FormData();
    fd.set("name", "Alice");
    fd.set("age", "30");

    const result = parseFormData(testSchema, fd, ["name", "age"]);
    expect(result).toEqual({
      success: true,
      data: { name: "Alice", age: "30" },
    });
  });

  it("returns error for invalid form data", () => {
    const fd = new FormData();
    // name is missing

    const result = parseFormData(testSchema, fd, ["name", "age"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("treats missing fields as undefined", () => {
    const fd = new FormData();
    fd.set("name", "Bob");

    const result = parseFormData(testSchema, fd, ["name", "age"]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeUndefined();
    }
  });
});
