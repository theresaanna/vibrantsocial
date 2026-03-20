"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { authLimiter, isRateLimited } from "@/lib/rate-limit";

interface LoginState {
  success: boolean;
  message: string;
}

export async function loginWithCredentials(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(authLimiter, `login:${ip}`)) {
    return { success: false, message: "Too many attempts. Please try again later." };
  }

  try {
    await signIn("credentials", {
      email: (formData.get("email") as string)?.trim().toLowerCase(),
      password: formData.get("password") as string,
      redirectTo: "/complete-profile",
    });
    return { success: true, message: "" };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { success: false, message: "Invalid email or password" };
      }
      return { success: false, message: "Something went wrong" };
    }
    throw error; // Re-throw NEXT_REDIRECT
  }
}
