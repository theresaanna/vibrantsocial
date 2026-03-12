"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface SubscriptionState {
  success: boolean;
  message: string;
}

export async function toggleTagSubscription(
  _prevState: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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
): Promise<SubscriptionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

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

export async function getTagSubscriptionStatus(
  tagName: string
): Promise<{ subscribed: boolean; frequency: string; tagId: string } | null> {
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
    tagId: tag.id,
  };
}
