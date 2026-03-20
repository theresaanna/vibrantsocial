"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/email";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

export interface ReportState {
  success: boolean;
  message: string;
}

const VALID_CONTENT_TYPES = ["post", "comment", "profile"] as const;

export async function submitReport(
  _prevState: ReportState,
  formData: FormData
): Promise<ReportState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "You must be logged in to submit a report." };
  }

  if (await isRateLimited(apiLimiter, `report:${session.user.id}`)) {
    return { success: false, message: "Too many reports. Please try again later." };
  }

  const contentType = formData.get("contentType") as string;
  const contentId = formData.get("contentId") as string;
  const description = (formData.get("description") as string)?.trim();

  if (!contentType || !VALID_CONTENT_TYPES.includes(contentType as (typeof VALID_CONTENT_TYPES)[number])) {
    return { success: false, message: "Invalid content type." };
  }

  if (!contentId) {
    return { success: false, message: "Missing content ID." };
  }

  if (!description) {
    return { success: false, message: "Please describe what you are reporting." };
  }

  if (description.length > 2000) {
    return { success: false, message: "Description must be 2000 characters or fewer." };
  }

  const reporter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true },
  });

  if (!reporter?.email) {
    return { success: false, message: "Could not find your account." };
  }

  let contentPreview = "";

  if (contentType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: contentId },
      select: { content: true },
    });
    contentPreview = post?.content?.slice(0, 200) ?? "Post not found";
  } else if (contentType === "comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: contentId },
      select: { content: true, postId: true },
    });
    contentPreview = comment?.content?.slice(0, 200) ?? "Comment not found";
  } else if (contentType === "profile") {
    const user = await prisma.user.findUnique({
      where: { id: contentId },
      select: { username: true, displayName: true },
    });
    contentPreview = user?.username ?? "User not found";
  }

  await sendReportEmail({
    reporterUsername: reporter.username ?? "unknown",
    reporterEmail: reporter.email,
    contentType: contentType as "post" | "comment" | "profile",
    contentId,
    contentPreview,
    description,
  });

  return {
    success: true,
    message: "Thank you for your report. A human will review this and respond as soon as possible.",
  };
}
