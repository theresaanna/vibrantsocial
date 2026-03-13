import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthError } from "next-auth";

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
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

describe("loginWithCredentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls signIn with credentials and redirectTo", async () => {
    mockSignIn.mockResolvedValueOnce(undefined as never);
    const result = await loginWithCredentials(
      prevState,
      makeFormData({ email: "test@example.com", password: "password123" })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("");
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "password123",
      redirectTo: "/complete-profile",
    });
  });

  it("returns invalid credentials error for CredentialsSignin", async () => {
    const error = new AuthError("CredentialsSignin");
    error.type = "CredentialsSignin";
    mockSignIn.mockRejectedValueOnce(error);

    const result = await loginWithCredentials(
      prevState,
      makeFormData({ email: "test@example.com", password: "wrong" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid email or password");
  });

  it("returns generic error for other AuthError types", async () => {
    const error = new AuthError("Configuration");
    error.type = "Configuration";
    mockSignIn.mockRejectedValueOnce(error);

    const result = await loginWithCredentials(
      prevState,
      makeFormData({ email: "test@example.com", password: "password123" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Something went wrong");
  });

  it("re-throws non-AuthError (e.g. NEXT_REDIRECT)", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    mockSignIn.mockRejectedValueOnce(redirectError);

    await expect(
      loginWithCredentials(
        prevState,
        makeFormData({ email: "test@example.com", password: "password123" })
      )
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
