"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface ProfileState {
  success: boolean;
  message: string;
}

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const username = formData.get("username") as string | null;
  const displayName = formData.get("displayName") as string | null;
  const bio = formData.get("bio") as string | null;

  if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return {
      success: false,
      message:
        "Username must be 3-30 characters, letters, numbers, and underscores only",
    };
  }

  if (username) {
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "Username is already taken" };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      username: username || null,
      displayName: displayName || null,
      bio: bio || null,
    },
  });

  revalidatePath("/profile");
  return { success: true, message: "Profile updated" };
}
