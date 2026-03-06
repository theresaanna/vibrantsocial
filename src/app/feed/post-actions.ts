"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { revalidatePath } from "next/cache";

interface ActionState {
  success: boolean;
  message: string;
}

export async function toggleLike(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({
      data: { postId, userId: session.user.id },
    });
  }

  revalidatePath("/feed");
  return { success: true, message: existing ? "Unliked" : "Liked" };
}

export async function toggleBookmark(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  const existing = await prisma.bookmark.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.bookmark.create({
      data: { postId, userId: session.user.id },
    });
  }

  revalidatePath("/feed");
  return { success: true, message: existing ? "Unbookmarked" : "Bookmarked" };
}

export async function toggleRepost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  const existing = await prisma.repost.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.repost.delete({ where: { id: existing.id } });
  } else {
    await prisma.repost.create({
      data: { postId, userId: session.user.id },
    });
  }

  revalidatePath("/feed");
  return { success: true, message: existing ? "Unreposted" : "Reposted" };
}

export async function createComment(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return {
      success: false,
      message: "Phone verification required to comment",
    };
  }

  const postId = formData.get("postId") as string;
  const content = (formData.get("content") as string)?.trim();
  const parentId = (formData.get("parentId") as string) || null;

  if (!content) {
    return { success: false, message: "Comment cannot be empty" };
  }

  if (content.length > 1000) {
    return { success: false, message: "Comment too long (max 1000 characters)" };
  }

  await prisma.comment.create({
    data: { content, postId, authorId: session.user.id, parentId },
  });

  revalidatePath("/feed");
  return { success: true, message: "Comment added" };
}
