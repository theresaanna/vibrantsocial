"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invalidateUserPrefs } from "@/lib/user-prefs";

export async function toggleNsfwContent(): Promise<{ showNsfwContent: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { showNsfwContent: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { showNsfwContent: true },
  });

  const newValue = !(user?.showNsfwContent ?? false);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { showNsfwContent: newValue },
  });

  await invalidateUserPrefs(session.user.id);

  return { showNsfwContent: newValue };
}

export async function getNsfwContentSetting(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { showNsfwContent: true },
  });

  return user?.showNsfwContent ?? false;
}
