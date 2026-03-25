import { z } from "zod";

// ── Reusable primitives ──────────────────────────────────────────────
export const cuidSchema = z.string().min(1, "Required");
export const turnstileTokenSchema = z.string().min(1, "CAPTCHA verification required");

// ── Auth schemas ─────────────────────────────────────────────────────

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-zA-Z0-9_]{3,30}$/,
        "Username must be 3-30 characters, letters, numbers, and underscores only"
      ),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    agreeToTos: z.literal("true", {
      errorMap: () => ({
        message: "You must agree to the Terms of Service and Privacy Policy",
      }),
    }),
    referralCode: z.string().trim().optional().default(""),
    "cf-turnstile-response": z.string().optional().default(""),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      const dob = new Date(data.dateOfBirth);
      if (isNaN(dob.getTime())) return false;
      if (dob > new Date()) return false;
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dob.getDate())
      ) {
        age--;
      }
      return age >= 18;
    },
    {
      message: "You must be at least 18 years old to sign up",
      path: ["dateOfBirth"],
    }
  );

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  "cf-turnstile-response": z.string().optional().default(""),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  "cf-turnstile-response": z.string().optional().default(""),
});

// ── Chat schemas ─────────────────────────────────────────────────────

export const sendMessageSchema = z
  .object({
    conversationId: cuidSchema,
    content: z.string().max(5000, "Message too long (max 5000 characters)"),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["image", "video", "audio", "document"]).optional(),
    mediaFileName: z.string().optional(),
    mediaFileSize: z.number().optional(),
    replyToId: z.string().optional(),
  })
  .refine((data) => data.content.trim() || data.mediaUrl, {
    message: "Message cannot be empty",
  });

export const editMessageSchema = z.object({
  messageId: cuidSchema,
  content: z.string().trim().min(1, "Message cannot be empty").max(5000, "Message too long"),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name too long"),
  participantIds: z
    .array(z.string().min(1))
    .min(2, "Groups need at least 2 other members")
    .max(50, "Groups can have at most 50 members"),
});

export const toggleReactionSchema = z.object({
  messageId: cuidSchema,
  emoji: z.string().min(1).max(10),
});

// ── Search schemas ───────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  query: z.string().trim().min(2, "Search query too short"),
  cursor: z.string().optional(),
});

// ── Wall post schemas ────────────────────────────────────────────────

export const wallPostStatusSchema = z.object({
  wallPostId: cuidSchema,
  status: z.enum(["accepted", "hidden"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
});

// ── Push unsubscribe ─────────────────────────────────────────────────

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
});

// ── Helper: extract + validate FormData ──────────────────────────────

export function parseFormData<T>(
  schema: z.ZodType<T>,
  formData: FormData,
  fields: string[]
): { success: true; data: T } | { success: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData.get(field);
    raw[field] = value === null ? undefined : value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }
  return { success: true, data: result.data };
}
