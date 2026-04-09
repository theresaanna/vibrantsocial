import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthError } from "next-auth";

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
}));

const mockIsRateLimited = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  authLimiter: { id: "mock-auth-limiter" },
  isRateLimited: (...args: unknown[]) => mockIsRateLimited(...args),
}));

const mockVerifyTurnstile = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstile(...args),
}));

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

import { signIn } from "@/auth";
import { loginWithCredentials } from "@/app/login/actions";

const mockSignIn = vi.mocked(signIn);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

const validForm = {
  email: "test@example.com",
  password: "password123",
  "cf-turnstile-response": "turnstile-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsRateLimited.mockResolvedValue(false);
  mockVerifyTurnstile.mockResolvedValue(true);
  mockHeaders.mockResolvedValue(
    new Map([["x-forwarded-for", "1.2.3.4"]])
  );
});

describe("loginWithCredentials", () => {
  // ---- Rate limiting ----

  describe("rate limiting", () => {
    it("returns rate limit error when rate limited", async () => {
      mockIsRateLimited.mockResolvedValue(true);

      const result = await loginWithCredentials(prevState, makeFormData(validForm));

      expect(result.success).toBe(false);
      expect(result.message).toContain("Too many attempts");
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("uses IP from x-forwarded-for header for rate limiting", async () => {
      mockIsRateLimited.mockResolvedValue(true);

      await loginWithCredentials(prevState, makeFormData(validForm));

      expect(mockIsRateLimited).toHaveBeenCalledWith(
        expect.anything(),
        "login:1.2.3.4"
      );
    });

    it("uses 'unknown' when x-forwarded-for is missing", async () => {
      mockHeaders.mockResolvedValue(new Map());
      mockIsRateLimited.mockResolvedValue(true);

      await loginWithCredentials(prevState, makeFormData(validForm));

      expect(mockIsRateLimited).toHaveBeenCalledWith(
        expect.anything(),
        "login:unknown"
      );
    });

    it("uses first IP from comma-separated x-forwarded-for", async () => {
      mockHeaders.mockResolvedValue(
        new Map([["x-forwarded-for", "5.6.7.8, 9.10.11.12"]])
      );
      mockIsRateLimited.mockResolvedValue(true);

      await loginWithCredentials(prevState, makeFormData(validForm));

      expect(mockIsRateLimited).toHaveBeenCalledWith(
        expect.anything(),
        "login:5.6.7.8"
      );
    });
  });

  // ---- Validation ----

  describe("validation", () => {
    it("returns validation error for missing email", async () => {
      const result = await loginWithCredentials(
        prevState,
        makeFormData({ password: "password123", "cf-turnstile-response": "tok" })
      );
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("returns validation error for missing password", async () => {
      const result = await loginWithCredentials(
        prevState,
        makeFormData({ email: "test@example.com", "cf-turnstile-response": "tok" })
      );
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  // ---- Turnstile CAPTCHA ----

  describe("turnstile verification", () => {
    it("returns CAPTCHA error when verification fails", async () => {
      mockVerifyTurnstile.mockResolvedValue(false);

      const result = await loginWithCredentials(prevState, makeFormData(validForm));

      expect(result.success).toBe(false);
      expect(result.message).toContain("CAPTCHA");
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("passes turnstile token to verifier", async () => {
      mockSignIn.mockResolvedValueOnce(undefined as never);

      await loginWithCredentials(prevState, makeFormData(validForm));

      expect(mockVerifyTurnstile).toHaveBeenCalledWith("turnstile-token");
    });
  });

  // ---- Successful login ----

  describe("successful authentication", () => {
    it("calls signIn with credentials and redirectTo", async () => {
      mockSignIn.mockResolvedValueOnce(undefined as never);

      const result = await loginWithCredentials(prevState, makeFormData(validForm));

      expect(result.success).toBe(true);
      expect(result.message).toBe("");
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        redirectTo: "/complete-profile",
      });
    });
  });

  // ---- Error handling ----

  describe("error handling", () => {
    it("returns invalid credentials error for CredentialsSignin", async () => {
      const error = new AuthError("CredentialsSignin");
      error.type = "CredentialsSignin";
      mockSignIn.mockRejectedValueOnce(error);

      const result = await loginWithCredentials(prevState, makeFormData(validForm));

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid email or password");
    });

    it("returns generic error for other AuthError types", async () => {
      const error = new AuthError("Configuration");
      error.type = "Configuration";
      mockSignIn.mockRejectedValueOnce(error);

      const result = await loginWithCredentials(prevState, makeFormData(validForm));

      expect(result.success).toBe(false);
      expect(result.message).toBe("Something went wrong");
    });

    it("re-throws non-AuthError (e.g. NEXT_REDIRECT)", async () => {
      const redirectError = new Error("NEXT_REDIRECT");
      mockSignIn.mockRejectedValueOnce(redirectError);

      await expect(
        loginWithCredentials(prevState, makeFormData(validForm))
      ).rejects.toThrow("NEXT_REDIRECT");
    });
  });

  // ---- Order of operations ----

  describe("execution order", () => {
    it("checks rate limit before validation", async () => {
      mockIsRateLimited.mockResolvedValue(true);

      // Even with invalid form data, rate limit should kick in first
      const result = await loginWithCredentials(prevState, makeFormData({}));

      expect(result.message).toContain("Too many attempts");
      expect(mockVerifyTurnstile).not.toHaveBeenCalled();
    });

    it("checks validation before turnstile", async () => {
      // Missing email — should fail validation before reaching turnstile
      const result = await loginWithCredentials(
        prevState,
        makeFormData({ password: "pass", "cf-turnstile-response": "tok" })
      );

      expect(result.success).toBe(false);
      expect(mockVerifyTurnstile).not.toHaveBeenCalled();
    });

    it("checks turnstile before signIn", async () => {
      mockVerifyTurnstile.mockResolvedValue(false);

      await loginWithCredentials(prevState, makeFormData(validForm));

      expect(mockVerifyTurnstile).toHaveBeenCalled();
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });
});
