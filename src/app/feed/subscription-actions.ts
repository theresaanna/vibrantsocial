"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuthWithRateLimit, isActionError } from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function togglePostSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("post-sub");
  if (isActionError(result)) return result;
  const session = result;

  const userId = formData.get("userId") as string;
  if (!userId) {
    return { success: false, message: "User ID required" };
  }

  if (userId === session.user.id) {
    return { success: false, message: "Cannot subscribe to yourself" };
  }

  const existing = await prisma.postSubscription.findUnique({
    where: {
      subscriberId_subscribedToId: {
        subscriberId: session.user.id,
        subscribedToId: userId,
      },
    },
  });

  if (existing) {
    await prisma.postSubscription.delete({ where: { id: existing.id } });
    revalidatePath(`/`);
    return { success: true, message: "Unsubscribed from posts" };
  }

  await prisma.postSubscription.create({
    data: {
      subscriberId: session.user.id,
      subscribedToId: userId,
    },
  });

  revalidatePath(`/`);
  return { success: true, message: "Subscribed to posts" };
}

export async function isSubscribedToUser(userId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const sub = await prisma.postSubscription.findUnique({
    where: {
      subscriberId_subscribedToId: {
        subscriberId: session.user.id,
        subscribedToId: userId,
      },
    },
  });

  return !!sub;
}
