"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSupportEmail } from "@/lib/email";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

export interface SupportState {
  success: boolean;
  message: string;
}

const VALID_SUBJECTS = [
  "bug_report",
  "appeal_content_warning",
  "abuse_report",
  "feature_request",
  "feedback",
  "other",
] as const;

export type SupportSubject = (typeof VALID_SUBJECTS)[number];

export async function submitSupportRequest(
  _prevState: SupportState,
  formData: FormData
): Promise<SupportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "You must be logged in to submit a support request." };
  }

  if (await isRateLimited(apiLimiter, `support:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const subject = formData.get("subject") as string;
  const body = (formData.get("body") as string)?.trim();

  if (!subject || !VALID_SUBJECTS.includes(subject as SupportSubject)) {
    return { success: false, message: "Please select a subject." };
  }

  if (!body) {
    return { success: false, message: "Please describe your issue." };
  }

  if (body.length > 5000) {
    return { success: false, message: "Message must be 5000 characters or fewer." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true },
  });

  if (!user?.email) {
    return { success: false, message: "Could not find your account." };
  }

  await sendSupportEmail({
    username: user.username ?? "unknown",
    email: user.email,
    subject,
    body,
  });

  return {
    success: true,
    message: "Your message has been sent. We'll get back to you as soon as possible.",
  };
}
