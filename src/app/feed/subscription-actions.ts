"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface SubscriptionState {
  success: boolean;
  message: string;
}

export async function togglePostSubscription(
  _prevState: SubscriptionState,
  formData: FormData
): Promise<SubscriptionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `post-sub:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

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
