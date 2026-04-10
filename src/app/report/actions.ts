"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail } from "@/lib/email";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

export interface ReportState {
  success: boolean;
  message: string;
}

const VALID_CONTENT_TYPES = ["post", "comment", "profile", "conversation"] as const;

const VALID_CATEGORIES = [
  "harassment", "hate_speech", "spam", "csam", "self_harm",
  "violence", "nudity_unmarked", "impersonation", "privacy", "other",
] as const;

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
  const category = formData.get("category") as string;
  const description = (formData.get("description") as string)?.trim();

  if (!contentType || !VALID_CONTENT_TYPES.includes(contentType as (typeof VALID_CONTENT_TYPES)[number])) {
    return { success: false, message: "Invalid content type." };
  }

  if (!contentId) {
    return { success: false, message: "Missing content ID." };
  }

  if (!category || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return { success: false, message: "Please select a report category." };
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
  } else if (contentType === "conversation") {
    const conv = await prisma.conversation.findUnique({
      where: { id: contentId },
      include: {
        participants: {
          include: { user: { select: { username: true } } },
          take: 5,
        },
      },
    });
    contentPreview = conv
      ? `Conversation with ${conv.participants.map((p: { user: { username: string | null } }) => p.user.username ?? "unknown").join(", ")}`
      : "Conversation not found";
  }

  // Persist the report in the database for audit trail
  await prisma.report.create({
    data: {
      reporterId: session.user.id,
      contentType,
      contentId,
      category,
      description,
    },
  });

  // Also send email notification to admin
  await sendReportEmail({
    reporterUsername: reporter.username ?? "unknown",
    reporterEmail: reporter.email,
    contentType: contentType as "post" | "comment" | "profile" | "conversation",
    contentId,
    contentPreview,
    description,
    category,
  });

  return {
    success: true,
    message: "Thank you for your report. A human will review this and respond as soon as possible.",
  };
}
