"use server";

import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { revalidatePath } from "next/cache";
import {
  extractMentionsFromLexicalJson,
  createMentionNotifications,
} from "@/lib/mentions";
import {
  requireAuthWithRateLimit,
  isActionError,
  areFriends,
  createNotificationSafe,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

export async function createWallPost(
  _prevState: ActionState & { postId?: string },
  formData: FormData
): Promise<ActionState & { postId?: string }> {
  const result = await requireAuthWithRateLimit("feed");
  if (isActionError(result)) return result;
  const session = result;

  const isNotSuspended = await requireNotSuspended(session.user.id);
  if (!isNotSuspended) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return { success: false, message: "Phone verification required to post" };
  }

  const isOldEnough = await requireMinimumAge(session.user.id, 18);
  if (!isOldEnough) {
    return { success: false, message: "You must be 18 or older to post" };
  }

  const wallOwnerId = formData.get("wallOwnerId") as string;
  if (!wallOwnerId) {
    return { success: false, message: "Wall owner is required" };
  }

  if (wallOwnerId === session.user.id) {
    return { success: false, message: "You cannot post on your own wall" };
  }

  const content = formData.get("content") as string;
  if (!content) {
    return { success: false, message: "Post content is required" };
  }

  try {
    const parsed = JSON.parse(content);
    const text = JSON.stringify(parsed);
    if (text.length < 50) {
      return { success: false, message: "Post cannot be empty" };
    }
  } catch {
    return { success: false, message: "Invalid post content" };
  }

  // Check friendship
  const isFriend = await areFriends(session.user.id, wallOwnerId);

  if (!isFriend) {
    return { success: false, message: "Only friends can post on each other's walls" };
  }

  // Get wall owner's username for revalidation
  const wallOwner = await prisma.user.findUnique({
    where: { id: wallOwnerId },
    select: { username: true },
  });

  if (!wallOwner?.username) {
    return { success: false, message: "Wall owner not found" };
  }

  // Create the post and wall post record
  const post = await prisma.post.create({
    data: {
      content,
      authorId: session.user.id,
    },
  });

  await prisma.wallPost.create({
    data: {
      postId: post.id,
      wallOwnerId,
    },
  });

  // Send notification to wall owner
  await createNotificationSafe({
    type: "WALL_POST",
    actorId: session.user.id,
    targetUserId: wallOwnerId,
    postId: post.id,
  });

  // Handle mentions
  const mentionedUsernames = extractMentionsFromLexicalJson(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({ usernames: mentionedUsernames, actorId: session.user.id, postId: post.id });
  }

  revalidatePath(`/${wallOwner.username}`);
  revalidatePath("/feed");

  return { success: true, message: "Wall post created", postId: post.id };
}

export async function updateWallPostStatus(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("wall");
  if (isActionError(result)) return result;
  const session = result;

  const wallPostId = formData.get("wallPostId") as string;
  const status = formData.get("status") as string;

  if (!wallPostId || !status) {
    return { success: false, message: "Missing required fields" };
  }

  if (status !== "accepted" && status !== "hidden") {
    return { success: false, message: "Invalid status" };
  }

  const wallPost = await prisma.wallPost.findUnique({
    where: { id: wallPostId },
    include: { wallOwner: { select: { username: true } } },
  });

  if (!wallPost) {
    return { success: false, message: "Wall post not found" };
  }

  if (wallPost.wallOwnerId !== session.user.id) {
    return { success: false, message: "Only the wall owner can moderate wall posts" };
  }

  await prisma.wallPost.update({
    where: { id: wallPostId },
    data: { status },
  });

  if (wallPost.wallOwner.username) {
    revalidatePath(`/${wallPost.wallOwner.username}`);
  }
  revalidatePath("/feed");

  return { success: true, message: `Wall post ${status}` };
}

export async function deleteWallPost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await requireAuthWithRateLimit("wall");
  if (isActionError(result)) return result;
  const session = result;

  const wallPostId = formData.get("wallPostId") as string;
  if (!wallPostId) {
    return { success: false, message: "Wall post ID is required" };
  }

  const wallPost = await prisma.wallPost.findUnique({
    where: { id: wallPostId },
    include: {
      post: { select: { authorId: true } },
      wallOwner: { select: { username: true } },
    },
  });

  if (!wallPost) {
    return { success: false, message: "Wall post not found" };
  }

  // Either the poster or the wall owner can delete
  if (wallPost.post.authorId !== session.user.id && wallPost.wallOwnerId !== session.user.id) {
    return { success: false, message: "Not authorized to delete this wall post" };
  }

  // Delete the post (cascades to wall post)
  await prisma.post.delete({ where: { id: wallPost.postId } });

  if (wallPost.wallOwner.username) {
    revalidatePath(`/${wallPost.wallOwner.username}`);
  }

  return { success: true, message: "Wall post deleted" };
}
