"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function toggleCommentSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("comment-sub");
  if (isActionError(result)) return result;
  const session = result;

  const postId = formData.get("postId") as string;
  if (!postId) {
    return { success: false, message: "Post ID required" };
  }

  const existing = await prisma.commentSubscription.findUnique({
    where: {
      userId_postId: {
        userId: session.user.id,
        postId,
      },
    },
  });

  if (existing) {
    await prisma.commentSubscription.delete({ where: { id: existing.id } });
    revalidatePath(`/post/${postId}`);
    return { success: true, message: "Unsubscribed from comments" };
  }

  await prisma.commentSubscription.create({
    data: {
      userId: session.user.id,
      postId,
    },
  });

  revalidatePath(`/post/${postId}`);
  return { success: true, message: "Subscribed to comments" };
}

export async function toggleCommentSubscriptionEmail(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("comment-sub");
  if (isActionError(result)) return result;
  const session = result;

  const postId = formData.get("postId") as string;
  if (!postId) {
    return { success: false, message: "Post ID required" };
  }

  const existing = await prisma.commentSubscription.findUnique({
    where: {
      userId_postId: {
        userId: session.user.id,
        postId,
      },
    },
  });

  if (!existing) {
    return { success: false, message: "Not subscribed to this post" };
  }

  await prisma.commentSubscription.update({
    where: { id: existing.id },
    data: { emailEnabled: !existing.emailEnabled },
  });

  revalidatePath(`/post/${postId}`);
  return { success: true, message: existing.emailEnabled ? "Emails disabled" : "Emails enabled" };
}

export async function isSubscribedToComments(
  postId: string
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const sub = await prisma.commentSubscription.findUnique({
    where: {
      userId_postId: {
        userId: session.user.id,
        postId,
      },
    },
  });

  return !!sub;
}
