"use server";

import { prisma } from "@/lib/prisma";

interface WaitlistState {
  success: boolean;
  message: string;
}

export async function joinPremiumWaitlist(
  _prevState: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { success: false, message: "Email is required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Invalid email address" };
  }

  const existing = await prisma.premiumWaitlist.findUnique({
    where: { email },
  });

  if (existing) {
    return { success: true, message: "You're already on the list! We'll be in touch." };
  }

  await prisma.premiumWaitlist.create({
    data: { email },
  });

  return { success: true, message: "You're on the list! We'll notify you when Premium launches." };
}
