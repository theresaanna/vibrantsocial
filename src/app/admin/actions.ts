"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendSuspensionEmail, sendAppealResponseEmail, sendContentNoticeEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

function requireAdmin(userId: string | undefined): string {
  if (!userId || !isAdmin(userId)) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export async function suspendUser(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const userId = formData.get("userId") as string;
  const reason = (formData.get("reason") as string)?.trim() || "Violation of community guidelines";

  if (!userId) throw new Error("Missing userId");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      suspended: true,
      suspendedAt: new Date(),
      suspensionReason: reason,
    },
    select: { email: true },
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      userId,
      action: "suspend",
      reason,
    },
  });

  if (user.email) {
    await sendSuspensionEmail({ toEmail: user.email, reason });
  }

  revalidatePath("/admin");
}

export async function unsuspendUser(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Missing userId");

  await prisma.user.update({
    where: { id: userId },
    data: {
      suspended: false,
      suspendedAt: null,
      suspensionReason: null,
    },
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      userId,
      action: "unsuspend",
    },
  });

  revalidatePath("/admin");
}

export async function removeWarning(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Missing userId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { contentWarnings: true },
  });

  if (!user || user.contentWarnings <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: { contentWarnings: { decrement: 1 } },
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      userId,
      action: "remove_warning",
    },
  });

  revalidatePath("/admin");
}

export async function resetWarnings(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("Missing userId");

  await prisma.user.update({
    where: { id: userId },
    data: { contentWarnings: 0 },
  });

  await prisma.moderationAction.create({
    data: {
      adminId,
      userId,
      action: "reset_warnings",
    },
  });

  revalidatePath("/admin");
}

export async function reviewReport(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const reportId = formData.get("reportId") as string;
  const status = formData.get("status") as string || "reviewed";
  if (!reportId) throw new Error("Missing reportId");

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin");
}

export async function reviewViolation(formData: FormData) {
  const session = await auth();
  requireAdmin(session?.user?.id);

  const violationId = formData.get("violationId") as string;
  if (!violationId) throw new Error("Missing violationId");

  await prisma.contentViolation.update({
    where: { id: violationId },
    data: {
      action: "reviewed",
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin");
}

export async function reviewAppeal(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const appealId = formData.get("appealId") as string;
  const status = formData.get("status") as "approved" | "denied";
  const response = (formData.get("response") as string)?.trim() || "";

  if (!appealId || !status) throw new Error("Missing required fields");

  const appeal = await prisma.appeal.update({
    where: { id: appealId },
    data: {
      status,
      response,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    include: {
      user: { select: { id: true, email: true, contentWarnings: true } },
    },
  });

  // If approved and it's a suspension appeal, unsuspend the user
  if (status === "approved" && appeal.type === "suspension") {
    await prisma.user.update({
      where: { id: appeal.userId },
      data: {
        suspended: false,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await prisma.moderationAction.create({
      data: {
        adminId,
        userId: appeal.userId,
        action: "unsuspend",
        reason: `Appeal approved: ${response}`,
        targetId: appealId,
      },
    });
  }

  // If approved and it's a content warning appeal, decrement warning count
  if (status === "approved" && appeal.type === "content_warning") {
    if (appeal.user.contentWarnings > 0) {
      await prisma.user.update({
        where: { id: appeal.userId },
        data: { contentWarnings: { decrement: 1 } },
      });
    }
  }

  if (appeal.user.email) {
    await sendAppealResponseEmail({
      toEmail: appeal.user.email,
      status,
      response: response || (status === "approved" ? "Your appeal has been approved." : "Your appeal has been denied."),
    });
  }

  revalidatePath("/admin");
}

const WARNING_LABELS: Record<string, string> = {
  isNsfw: "NSFW",
  isGraphicNudity: "Explicit / Graphic",
  isSensitive: "Sensitive",
};

export async function applyContentWarning(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const postId = formData.get("postId") as string;
  const warningType = formData.get("warningType") as string;
  if (!postId || !warningType) throw new Error("Missing required fields");
  if (!WARNING_LABELS[warningType]) throw new Error("Invalid warning type");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isNsfw: true, isGraphicNudity: true, isSensitive: true },
  });
  if (!post) throw new Error("Post not found");
  if (post[warningType as keyof typeof post] === true) return;

  await prisma.post.update({
    where: { id: postId },
    data: { [warningType]: true },
  });

  if (post.authorId) {
    const user = await prisma.user.update({
      where: { id: post.authorId },
      data: { contentWarnings: { increment: 1 } },
      select: { email: true, contentWarnings: true },
    });

    await prisma.moderationAction.create({
      data: {
        adminId,
        userId: post.authorId,
        action: "content_warning",
        reason: `Applied "${WARNING_LABELS[warningType]}" to post ${postId}`,
        targetId: postId,
      },
    });

    if (user.email) {
      await sendContentNoticeEmail({
        toEmail: user.email,
        postId,
        markingLabel: WARNING_LABELS[warningType],
        warningCount: user.contentWarnings,
      });
    }
  }

  revalidatePath("/admin");
}

export async function removeContentWarning(formData: FormData) {
  const session = await auth();
  const adminId = requireAdmin(session?.user?.id);

  const postId = formData.get("postId") as string;
  const warningType = formData.get("warningType") as string;
  if (!postId || !warningType) throw new Error("Missing required fields");
  if (!WARNING_LABELS[warningType]) throw new Error("Invalid warning type");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) throw new Error("Post not found");

  await prisma.post.update({
    where: { id: postId },
    data: { [warningType]: false },
  });

  if (post.authorId) {
    await prisma.moderationAction.create({
      data: {
        adminId,
        userId: post.authorId,
        action: "remove_content_warning",
        reason: `Removed "${WARNING_LABELS[warningType]}" from post ${postId}`,
        targetId: postId,
      },
    });
  }

  revalidatePath("/admin");
}

export async function searchPostsForWarning(query: string) {
  const session = await auth();
  requireAdmin(session?.user?.id);

  if (!query.trim()) return [];

  const byId = await prisma.post.findUnique({
    where: { id: query.trim() },
    select: {
      id: true,
      content: true,
      isNsfw: true,
      isGraphicNudity: true,
      isSensitive: true,
      createdAt: true,
      author: { select: { id: true, username: true, avatar: true } },
    },
  });
  if (byId) return [byId];

  return prisma.post.findMany({
    where: { content: { contains: query.trim() } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      content: true,
      isNsfw: true,
      isGraphicNudity: true,
      isSensitive: true,
      createdAt: true,
      author: { select: { id: true, username: true, avatar: true } },
    },
  });
}
