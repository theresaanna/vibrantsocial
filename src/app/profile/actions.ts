"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { isValidHexColor, THEME_COLOR_FIELDS } from "@/lib/profile-themes";
import { invalidate, cacheKeys } from "@/lib/cache";

const MAX_BIO_REVISIONS = 20;

interface ProfileState {
  success: boolean;
  message: string;
}

async function pruneOldRevisions(userId: string) {
  const count = await prisma.bioRevision.count({ where: { userId } });
  if (count > MAX_BIO_REVISIONS) {
    const toDelete = await prisma.bioRevision.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_BIO_REVISIONS,
      select: { id: true },
    });
    await prisma.bioRevision.deleteMany({
      where: { id: { in: toDelete.map((r: { id: string }) => r.id) } },
    });
  }
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

  // Validate theme colors
  const themeColors: Record<string, string | null> = {};
  for (const field of THEME_COLOR_FIELDS) {
    const value = formData.get(field) as string | null;
    if (value && value.trim()) {
      if (!isValidHexColor(value.trim())) {
        return {
          success: false,
          message: `Invalid color value for ${field}. Must be a valid hex color (e.g. #ff0000).`,
        };
      }
      themeColors[field] = value.trim();
    } else {
      themeColors[field] = null;
    }
  }

  // Save current bio as a revision if it changed
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bio: true },
  });

  const newBio = bio || null;
  const oldBio = currentUser?.bio ?? null;

  if (oldBio !== null && oldBio !== newBio) {
    await prisma.bioRevision.create({
      data: { userId: session.user.id, content: oldBio },
    });
    await pruneOldRevisions(session.user.id);
  }

  const showNsfwByDefault = formData.get("showNsfwByDefault") === "true";
  const emailOnComment = formData.get("emailOnComment") === "true";
  const emailOnNewChat = formData.get("emailOnNewChat") === "true";
  const emailOnMention = formData.get("emailOnMention") === "true";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      username: username || null,
      displayName: displayName || null,
      bio: newBio,
      showNsfwByDefault,
      emailOnComment,
      emailOnNewChat,
      emailOnMention,
      ...themeColors,
    },
  });

  // Invalidate cached public profile
  if (username) {
    await invalidate(cacheKeys.userProfile(username));
  }

  revalidatePath("/profile");
  if (username) {
    revalidatePath(`/${username}`);
  }
  return { success: true, message: "Profile updated" };
}

export async function removeAvatar(): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatar: true, username: true },
  });

  // Delete from Vercel Blob if it's a blob URL
  if (user?.avatar?.includes("blob.vercel-storage.com")) {
    try {
      await del(user.avatar);
    } catch {
      // Non-critical — blob cleanup failed
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: null },
  });

  if (user?.username) {
    await invalidate(cacheKeys.userProfile(user.username));
  }

  revalidatePath("/profile");
  return { success: true, message: "Avatar removed" };
}

export async function getBioRevisions() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return prisma.bioRevision.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_BIO_REVISIONS,
    select: { id: true, content: true, createdAt: true },
  });
}

interface RestoreState {
  success: boolean;
  message: string;
  restoredContent?: string;
}

export async function restoreBioRevision(
  revisionId: string
): Promise<RestoreState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const revision = await prisma.bioRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision || revision.userId !== session.user.id) {
    return { success: false, message: "Revision not found" };
  }

  // Save current bio as a revision before restoring
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bio: true },
  });

  if (currentUser?.bio) {
    await prisma.bioRevision.create({
      data: { userId: session.user.id, content: currentUser.bio },
    });
    await pruneOldRevisions(session.user.id);
  }

  const userForCache = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bio: revision.content },
  });

  if (userForCache?.username) {
    await invalidate(cacheKeys.userProfile(userForCache.username));
  }

  revalidatePath("/profile");
  return {
    success: true,
    message: "Bio restored",
    restoredContent: revision.content,
  };
}
