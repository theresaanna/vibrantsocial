"use server";

import { prisma } from "@/lib/prisma";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { headers } from "next/headers";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeToPremiumNotify(
  email: string
): Promise<{ success: boolean; message: string }> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (await isRateLimited(apiLimiter, `premium-notify:${ip}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const trimmed = email.trim().toLowerCase();

  if (!trimmed || !isValidEmail(trimmed)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  try {
    const existing = await prisma.premiumWaitlist.findUnique({
      where: { email: trimmed },
    });

    if (existing) {
      return { success: true, message: "You're already on the list! We'll email you when premium launches." };
    }

    await prisma.premiumWaitlist.create({
      data: { email: trimmed },
    });

    return { success: true, message: "You're on the list! We'll send you one email when premium launches." };
  } catch {
    return { success: false, message: "Something went wrong. Please try again." };
  }
}
