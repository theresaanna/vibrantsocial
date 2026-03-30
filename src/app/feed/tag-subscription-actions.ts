"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function toggleTagSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("tag-sub");
  if (isActionError(result)) return result;
  const session = result;

  const tagId = formData.get("tagId") as string;
  if (!tagId) {
    return { success: false, message: "Tag ID required" };
  }

  const existing = await prisma.tagSubscription.findUnique({
    where: {
      userId_tagId: {
        userId: session.user.id,
        tagId,
      },
    },
  });

  if (existing) {
    await prisma.tagSubscription.delete({ where: { id: existing.id } });
    revalidatePath(`/`);
    return { success: true, message: "Unsubscribed from tag" };
  }

  await prisma.tagSubscription.create({
    data: {
      userId: session.user.id,
      tagId,
    },
  });

  revalidatePath(`/`);
  return { success: true, message: "Subscribed to tag" };
}

export async function updateTagSubscriptionFrequency(
  tagId: string,
  frequency: string
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("tag-sub");
  if (isActionError(result)) return result;
  const session = result;

  if (frequency !== "immediate" && frequency !== "digest") {
    return { success: false, message: "Invalid frequency" };
  }

  const existing = await prisma.tagSubscription.findUnique({
    where: {
      userId_tagId: {
        userId: session.user.id,
        tagId,
      },
    },
  });

  if (!existing) {
    return { success: false, message: "Not subscribed to this tag" };
  }

  await prisma.tagSubscription.update({
    where: { id: existing.id },
    data: { frequency },
  });

  return { success: true, message: `Frequency set to ${frequency}` };
}

export async function updateTagSubscriptionEmail(
  tagId: string,
  emailNotification: boolean,
  frequency?: string
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("tag-sub");
  if (isActionError(result)) return result;
  const session = result;

  if (frequency !== undefined && frequency !== "immediate" && frequency !== "digest") {
    return { success: false, message: "Invalid frequency" };
  }

  const existing = await prisma.tagSubscription.findUnique({
    where: {
      userId_tagId: {
        userId: session.user.id,
        tagId,
      },
    },
  });

  if (!existing) {
    return { success: false, message: "Not subscribed to this tag" };
  }

  const data: { emailNotification: boolean; frequency?: string } = {
    emailNotification,
  };
  if (frequency !== undefined) {
    data.frequency = frequency;
  }

  await prisma.tagSubscription.update({
    where: { id: existing.id },
    data,
  });

  return {
    success: true,
    message: emailNotification
      ? "Email notifications enabled"
      : "Email notifications disabled",
  };
}

export async function getTagSubscriptionStatus(
  tagName: string
): Promise<{ subscribed: boolean; frequency: string; emailNotification: boolean; tagId: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tag = await prisma.tag.findUnique({
    where: { name: tagName },
    select: { id: true },
  });

  if (!tag) return null;

  const sub = await prisma.tagSubscription.findUnique({
    where: {
      userId_tagId: {
        userId: session.user.id,
        tagId: tag.id,
      },
    },
  });

  return {
    subscribed: !!sub,
    frequency: sub?.frequency ?? "immediate",
    emailNotification: sub?.emailNotification ?? false,
    tagId: tag.id,
  };
}
