"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { revalidatePath } from "next/cache";
import { getAblyRestClient } from "@/lib/ably";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import {
  extractMentionsFromPlainText,
  createMentionNotifications,
} from "@/lib/mentions";

interface ActionState {
  success: boolean;
  message: string;
}

const commentAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  image: true,
  avatar: true,
} as const;

export async function fetchComments(postId: string) {
  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: commentAuthorSelect },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: commentAuthorSelect } },
      },
    },
  });

  return JSON.parse(JSON.stringify(comments));
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

  let authorUsername: string | null = null;

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { author: { select: { username: true } } },
    });
    authorUsername = post?.author?.username ?? null;
  } else {
    await prisma.like.create({
      data: { postId, userId: session.user.id },
    });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, author: { select: { username: true } } },
    });
    if (post) {
      authorUsername = post.author?.username ?? null;
      await createNotification({
        type: "LIKE",
        actorId: session.user.id,
        targetUserId: post.authorId,
        postId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/likes");
  if (authorUsername) {
    revalidatePath(`/${authorUsername}`);
  }
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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (post) {
      await createNotification({
        type: "BOOKMARK",
        actorId: session.user.id,
        targetUserId: post.authorId,
        postId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/bookmarks");
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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (post) {
      await createNotification({
        type: "REPOST",
        actorId: session.user.id,
        targetUserId: post.authorId,
        postId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }
  return { success: true, message: existing ? "Unreposted" : "Reposted" };
}

export async function createQuoteRepost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  const content = (formData.get("content") as string)?.trim();

  if (!content) {
    return { success: false, message: "Quote text cannot be empty" };
  }

  if (content.length > 500) {
    return { success: false, message: "Quote text too long (max 500 characters)" };
  }

  const existing = await prisma.repost.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    return { success: false, message: "You have already reposted this post" };
  }

  await prisma.repost.create({
    data: { postId, userId: session.user.id, content },
  });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (post) {
    await createNotification({
      type: "REPOST",
      actorId: session.user.id,
      targetUserId: post.authorId,
      postId,
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }
  return { success: true, message: "Quote posted" };
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

  const comment = await prisma.comment.create({
    data: { content, postId, authorId: session.user.id, parentId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          image: true,
          avatar: true,
        },
      },
    },
  });

  // Notify post author about the comment
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      authorId: true,
      author: {
        select: { email: true, emailOnComment: true },
      },
    },
  });
  if (post) {
    await createNotification({
      type: "COMMENT",
      actorId: session.user.id,
      targetUserId: post.authorId,
      postId,
      commentId: comment.id,
    });

    // Send email notification via background job
    if (
      post.authorId !== session.user.id &&
      post.author.email &&
      post.author.emailOnComment
    ) {
      const commenterName =
        comment.author.displayName ?? comment.author.username ?? "Someone";
      await inngest.send({
        name: "email/comment",
        data: { toEmail: post.author.email, commenterName, postId },
      });
    }
  }

  // If replying, also notify parent comment author
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { authorId: true },
    });
    if (parentComment && parentComment.authorId !== post?.authorId) {
      await createNotification({
        type: "REPLY",
        actorId: session.user.id,
        targetUserId: parentComment.authorId,
        postId,
        commentId: comment.id,
      });
    }
  }

  // Send mention notifications for @mentions in comment text
  const mentionedUsernames = extractMentionsFromPlainText(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({
      usernames: mentionedUsernames,
      actorId: session.user.id,
      postId,
      commentId: comment.id,
    });
  }

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`comments:${postId}`);
    await channel.publish("new", {
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      author: JSON.stringify(comment.author),
      createdAt: comment.createdAt.toISOString(),
    });
  } catch {
    // Non-critical — DB write succeeded
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  return { success: true, message: "Comment added" };
}
