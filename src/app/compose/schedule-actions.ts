"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkAndExpirePremium } from "@/lib/premium";
import { revalidatePath } from "next/cache";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";

export async function getScheduledPosts() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.post.findMany({
    where: {
      authorId: session.user.id,
      scheduledFor: { not: null, gt: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    select: {
      id: true,
      content: true,
      slug: true,
      scheduledFor: true,
      isSensitive: true,
      isNsfw: true,
      isGraphicNudity: true,
      isCloseFriendsOnly: true,
      hasCustomAudience: true,
      isLoggedInOnly: true,
      hideLinkPreview: true,
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
}

interface ScheduleState {
  success: boolean;
  message: string;
}

type ScheduledPostCheck = {
  userId: string;
  post: { authorId: string | null; scheduledFor: Date | null };
};

/** Shared auth, rate-limit, ownership, and "still scheduled" guard. */
async function requireOwnScheduledPost(
  postId: string
): Promise<ScheduleState | ScheduledPostCheck> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `schedule:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, scheduledFor: true },
  });

  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  if (!post.scheduledFor || post.scheduledFor <= new Date()) {
    return { success: false, message: "Post is already published" };
  }

  return { userId: session.user.id, post };
}

function isError(result: ScheduleState | ScheduledPostCheck): result is ScheduleState {
  return "success" in result;
}

export async function updatePostSchedule(
  postId: string,
  scheduledFor: string
): Promise<ScheduleState> {
  const check = await requireOwnScheduledPost(postId);
  if (isError(check)) return check;

  const isPremium = await checkAndExpirePremium(check.userId);
  if (!isPremium) {
    return { success: false, message: "Scheduling posts is a premium feature" };
  }

  const newDate = new Date(scheduledFor);
  if (isNaN(newDate.getTime()) || newDate <= new Date()) {
    return { success: false, message: "Scheduled time must be in the future" };
  }

  await prisma.post.update({
    where: { id: postId },
    data: { scheduledFor: newDate },
  });

  revalidatePath("/compose");
  return { success: true, message: "Schedule updated" };
}

export async function deleteScheduledPost(
  postId: string
): Promise<ScheduleState> {
  const check = await requireOwnScheduledPost(postId);
  if (isError(check)) return check;

  // Undo the star that was awarded at creation (clamp to 0)
  const user = await prisma.user.findUnique({
    where: { id: check.userId },
    select: { stars: true },
  });
  await prisma.$transaction([
    prisma.post.delete({ where: { id: postId } }),
    ...(user && user.stars > 0
      ? [prisma.user.update({
          where: { id: check.userId },
          data: { stars: { decrement: 1 } },
        })]
      : []),
  ]);

  revalidatePath("/compose");
  return { success: true, message: "Scheduled post deleted" };
}

export async function publishScheduledPostNow(
  postId: string
): Promise<ScheduleState> {
  const check = await requireOwnScheduledPost(postId);
  if (isError(check)) return check;

  await prisma.post.update({
    where: { id: postId },
    data: { scheduledFor: null, createdAt: new Date() },
  });

  revalidatePath("/compose");
  revalidatePath("/feed");
  return { success: true, message: "Post published" };
}
