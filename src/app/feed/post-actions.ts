"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { revalidatePath } from "next/cache";
import { getAblyRestClient } from "@/lib/ably";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import {
  extractMentionsFromPlainText,
  extractMentionsFromLexicalJson,
  createMentionNotifications,
} from "@/lib/mentions";
import { extractTagsFromNames } from "@/lib/tags";
import { invalidate, cacheKeys } from "@/lib/cache";
import { notifyPostSubscribers } from "@/lib/subscription-notifications";
import { checkStarsMilestone } from "@/lib/referral";
import { notifyCommentSubscribers } from "@/lib/comment-subscription-notifications";
import {
  requireAuthWithRateLimit,
  isActionError,
  hasBlock,
  groupReactions,
  invalidateTagCaches,
  USER_PROFILE_SELECT,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";

interface CommentActionState extends ActionState {
  comment?: {
    id: string;
    content: string;
    imageUrl: string | null;
    createdAt: Date;
    parentId: string | null;
    author: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
      image: string | null;
      avatar: string | null;
      profileFrameId: string | null;
      usernameFont: string | null;
      ageVerified: Date | null;
    };
    reactions: { emoji: string; userIds: string[] }[];
  };
}

const commentReactionSelect = {
  reactions: { select: { emoji: true, userId: true } },
} as const;

function transformCommentsWithReactions(
  comments: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return comments.map((c) => {
    const reactions = c.reactions as { emoji: string; userId: string }[] | undefined;
    const replies = c.replies as Array<Record<string, unknown>> | undefined;
    return {
      ...c,
      reactions: reactions ? groupReactions(reactions) : [],
      replies: replies ? transformCommentsWithReactions(replies) : undefined,
    };
  });
}

function buildCommentTree(
  comments: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const roots: Array<Record<string, unknown>> = [];

  for (const c of comments) {
    map.set(c.id as string, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id as string)!;
    const parentId = c.parentId as string | null;
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)!;
      (parent.replies as Array<Record<string, unknown>>).push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function fetchComments(postId: string) {
  const session = await auth();
  const blockedIds = session?.user?.id
    ? await getAllBlockRelatedIds(session.user.id)
    : [];

  // Fetch ALL comments flat, then build tree in JS to support unlimited nesting
  const allComments = await prisma.comment.findMany({
    where: {
      postId,
      ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: USER_PROFILE_SELECT },
      ...commentReactionSelect,
    },
  });

  return JSON.parse(JSON.stringify(transformCommentsWithReactions(buildCommentTree(allComments))));
}

export async function toggleLike(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const postId = formData.get("postId") as string;
  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  let authorUsername: string | null = null;

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { decrement: 1 } } });
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { author: { select: { username: true } } },
    });
    authorUsername = post?.author?.username ?? null;
  } else {
    await prisma.like.create({
      data: { postId, userId: session.user.id },
    });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
    await checkStarsMilestone(session.user.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, author: { select: { username: true } } },
    });
    if (post) {
      authorUsername = post.author?.username ?? null;
      if (post.authorId) {
        await createNotification({
          type: "LIKE",
          actorId: session.user.id,
          targetUserId: post.authorId,
          postId,
        });
      }
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
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

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
    if (post?.authorId) {
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
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const postId = formData.get("postId") as string;
  const existing = await prisma.repost.findFirst({
    where: { postId, userId: session.user.id, quotedRepostId: null },
  });

  if (existing) {
    await prisma.repost.delete({ where: { id: existing.id } });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { decrement: 1 } } });
  } else {
    await prisma.repost.create({
      data: { postId, userId: session.user.id },
    });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
    await checkStarsMilestone(session.user.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (post?.authorId) {
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
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const postId = formData.get("postId") as string;
  const quotedRepostId = (formData.get("quotedRepostId") as string) || null;
  const content = (formData.get("content") as string)?.trim();
  const isSensitive = formData.get("isSensitive") === "true";
  const isNsfw = formData.get("isNsfw") === "true";
  const isGraphicNudity = formData.get("isGraphicNudity") === "true";
  const isCloseFriendsOnly = formData.get("isCloseFriendsOnly") === "true";

  if (!content) {
    return { success: false, message: "Quote text cannot be empty" };
  }

  // Only enforce one-repost-per-post for direct reposts (not quoting a quote)
  if (!quotedRepostId) {
    const existing = await prisma.repost.findFirst({
      where: { postId, userId: session.user.id, quotedRepostId: null },
    });

    if (existing) {
      return { success: false, message: "You have already reposted this post" };
    }
  }

  const repost = await prisma.repost.create({
    data: { postId, userId: session.user.id, content, isSensitive, isNsfw, isGraphicNudity, isCloseFriendsOnly, quotedRepostId },
  });
  await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
  await checkStarsMilestone(session.user.id);

  // Attach tags (skip for sensitive/graphic; NSFW can have tags)
  const rawTags = formData.get("tags") as string;
  if (rawTags && !isSensitive && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags.split(","));
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.repostTag.create({
        data: { repostId: repost.id, tagId: tag.id },
      });
    }
    await invalidateTagCaches(tagNames, isNsfw);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (post?.authorId) {
    await createNotification({
      type: "REPOST",
      actorId: session.user.id,
      targetUserId: post.authorId,
      postId,
    });
  }

  // Send mention notifications for @mentions in quote content
  const mentionedUsernames = extractMentionsFromLexicalJson(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({
      usernames: mentionedUsernames,
      actorId: session.user.id,
      repostId: repost.id,
    });
  }

  // Notify post subscribers (quote reposts count as new content from the user)
  await notifyPostSubscribers({
    authorId: session.user.id,
    postId: repost.id,
    isSensitive,
    isNsfw,
    isGraphicNudity,
    isCloseFriendsOnly,
  });

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }
  return { success: true, message: "Quote posted" };
}

export async function editRepost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const repostId = formData.get("repostId") as string;
  const content = formData.get("content") as string;
  if (!repostId || !content) {
    return { success: false, message: "Repost ID and content required" };
  }

  const repost = await prisma.repost.findUnique({ where: { id: repostId } });
  if (!repost || repost.userId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  const isSensitive = formData.get("isSensitive") === "true";
  const isNsfw = formData.get("isNsfw") === "true";
  const isGraphicNudity = formData.get("isGraphicNudity") === "true";
  const isCloseFriendsOnly = formData.get("isCloseFriendsOnly") === "true";

  await prisma.repost.update({
    where: { id: repostId },
    data: { content, editedAt: new Date(), isSensitive, isNsfw, isGraphicNudity, isCloseFriendsOnly },
  });

  // Update tags
  const rawTags = formData.get("tags") as string;
  await prisma.repostTag.deleteMany({ where: { repostId } });
  if (rawTags && !isSensitive && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags.split(","));
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.repostTag.create({
        data: { repostId, tagId: tag.id },
      });
    }
    await invalidateTagCaches(tagNames, isNsfw);
  } else {
    await invalidate(cacheKeys.tagCloud());
    await invalidate(cacheKeys.nsfwTagCloud());
  }

  // Notify users who were newly mentioned in the edit
  if (repost.content) {
    const oldMentions = new Set(extractMentionsFromLexicalJson(repost.content));
    const newMentions = extractMentionsFromLexicalJson(content).filter(
      (u) => !oldMentions.has(u)
    );
    if (newMentions.length > 0) {
      await createMentionNotifications({
        usernames: newMentions,
        actorId: session.user.id,
        repostId: repostId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${repost.postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }
  return { success: true, message: "Quote updated" };
}

export async function togglePinRepost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const repostId = formData.get("repostId") as string;
  if (!repostId) {
    return { success: false, message: "Repost ID required" };
  }

  const repost = await prisma.repost.findUnique({ where: { id: repostId } });
  if (!repost || repost.userId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  if (repost.isPinned) {
    await prisma.repost.update({
      where: { id: repostId },
      data: { isPinned: false },
    });
  } else {
    // Unpin any currently pinned post or repost by this user, then pin this one
    await prisma.post.updateMany({
      where: { authorId: session.user.id, isPinned: true },
      data: { isPinned: false },
    });
    await prisma.repost.updateMany({
      where: { userId: session.user.id, isPinned: true },
      data: { isPinned: false },
    });
    await prisma.repost.update({
      where: { id: repostId },
      data: { isPinned: true },
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${repost.postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }

  return {
    success: true,
    message: repost.isPinned ? "Quote unpinned" : "Quote pinned",
  };
}

export async function deleteRepost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const repostId = formData.get("repostId") as string;
  if (!repostId) {
    return { success: false, message: "Repost ID required" };
  }

  const repost = await prisma.repost.findUnique({
    where: { id: repostId },
    include: { tags: { include: { tag: { select: { name: true } } } } },
  });
  if (!repost || repost.userId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.repost.delete({ where: { id: repostId } });

  if (repost.tags.length > 0) {
    const tagNames = repost.tags.map((rt) => rt.tag.name);
    await invalidateTagCaches(tagNames, repost.isNsfw);
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${repost.postId}`);
  if (session.user.username) {
    revalidatePath(`/${session.user.username}`);
  }
  return { success: true, message: "Quote deleted" };
}

export async function createComment(
  _prevState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const isNotSuspended = await requireNotSuspended(session.user.id);
  if (!isNotSuspended) {
    return { success: false, message: "Your account is suspended" };
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
  const imageUrl = (formData.get("imageUrl") as string) || null;

  if (!content && !imageUrl) {
    return { success: false, message: "Comment cannot be empty" };
  }

  if (content && content.length > 1000) {
    return { success: false, message: "Comment too long (max 1000 characters)" };
  }

  // Check if a block exists between the commenter and post author
  const post_ = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (post_?.authorId) {
    if (await hasBlock(session.user.id, post_.authorId)) {
      return { success: false, message: "Cannot comment on this post" };
    }
  }

  const comment = await prisma.comment.create({
    data: { content: content ?? "", imageUrl, postId, authorId: session.user.id, parentId },
    include: {
      author: { select: USER_PROFILE_SELECT },
    },
  });
  await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
  await checkStarsMilestone(session.user.id);

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
  if (post && post.authorId && post.author) {
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

  // Notify users subscribed to comments on this post
  const commenterName =
    comment.author.displayName ?? comment.author.username ?? "Someone";
  await notifyCommentSubscribers({
    postId,
    commentId: comment.id,
    commentAuthorId: session.user.id,
    commenterName,
  });

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`comments:${postId}`);
    await channel.publish("new", {
      id: comment.id,
      content: comment.content,
      imageUrl: comment.imageUrl,
      parentId: comment.parentId,
      author: JSON.stringify(comment.author),
      createdAt: comment.createdAt.toISOString(),
      actorId: session.user.id,
    });

    // Also publish updated comment count so PostCard can update immediately
    const count = await prisma.comment.count({ where: { postId } });
    await channel.publish("count", { count });
  } catch {
    // Non-critical — DB write succeeded
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  return {
    success: true,
    message: "Comment added",
    comment: {
      id: comment.id,
      content: comment.content,
      imageUrl: comment.imageUrl,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      author: comment.author,
      reactions: [],
    },
  };
}

// ── Quote post interactions ───────────────────────────────────────

export async function fetchRepostComments(repostId: string) {
  const session = await auth();
  const blockedIds = session?.user?.id
    ? await getAllBlockRelatedIds(session.user.id)
    : [];

  const allComments = await prisma.repostComment.findMany({
    where: {
      repostId,
      ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: USER_PROFILE_SELECT },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  return JSON.parse(JSON.stringify(transformCommentsWithReactions(buildCommentTree(allComments))));
}

export async function toggleRepostLike(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const repostId = formData.get("repostId") as string;
  const existing = await prisma.repostLike.findUnique({
    where: { repostId_userId: { repostId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.repostLike.delete({ where: { id: existing.id } });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { decrement: 1 } } });
  } else {
    await prisma.repostLike.create({
      data: { repostId, userId: session.user.id },
    });
    await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
    await checkStarsMilestone(session.user.id);

    const repost = await prisma.repost.findUnique({
      where: { id: repostId },
      select: { userId: true },
    });
    if (repost && repost.userId !== session.user.id) {
      await createNotification({
        type: "LIKE",
        actorId: session.user.id,
        targetUserId: repost.userId,
        repostId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/quote/${repostId}`);
  return { success: true, message: existing ? "Unliked" : "Liked" };
}

export async function toggleRepostBookmark(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const repostId = formData.get("repostId") as string;
  const existing = await prisma.repostBookmark.findUnique({
    where: { repostId_userId: { repostId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.repostBookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.repostBookmark.create({
      data: { repostId, userId: session.user.id },
    });

    const repost = await prisma.repost.findUnique({
      where: { id: repostId },
      select: { userId: true },
    });
    if (repost && repost.userId !== session.user.id) {
      await createNotification({
        type: "BOOKMARK",
        actorId: session.user.id,
        targetUserId: repost.userId,
        repostId,
      });
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/quote/${repostId}`);
  revalidatePath("/bookmarks");
  return { success: true, message: existing ? "Unbookmarked" : "Bookmarked" };
}

export async function createRepostComment(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const isNotSuspended = await requireNotSuspended(session.user.id);
  if (!isNotSuspended) {
    return { success: false, message: "Your account is suspended" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return {
      success: false,
      message: "Phone verification required to comment",
    };
  }

  const repostId = formData.get("repostId") as string;
  const content = (formData.get("content") as string)?.trim();
  const parentId = (formData.get("parentId") as string) || null;

  if (!content) {
    return { success: false, message: "Comment cannot be empty" };
  }

  if (content && content.length > 1000) {
    return { success: false, message: "Comment too long (max 1000 characters)" };
  }

  const comment = await prisma.repostComment.create({
    data: { content, repostId, authorId: session.user.id, parentId },
    include: {
      author: { select: USER_PROFILE_SELECT },
    },
  });
  await prisma.user.update({ where: { id: session.user.id }, data: { stars: { increment: 1 } } });
  await checkStarsMilestone(session.user.id);

  // Notify quote post author
  const repost = await prisma.repost.findUnique({
    where: { id: repostId },
    select: { userId: true },
  });
  if (repost && repost.userId !== session.user.id) {
    await createNotification({
      type: "COMMENT",
      actorId: session.user.id,
      targetUserId: repost.userId,
      repostId,
    });
  }

  // If replying, also notify parent comment author
  if (parentId) {
    const parentComment = await prisma.repostComment.findUnique({
      where: { id: parentId },
      select: { authorId: true },
    });
    if (parentComment && parentComment.authorId !== repost?.userId) {
      await createNotification({
        type: "REPLY",
        actorId: session.user.id,
        targetUserId: parentComment.authorId,
        repostId,
      });
    }
  }

  // Send mention notifications
  const mentionedUsernames = extractMentionsFromPlainText(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({
      usernames: mentionedUsernames,
      actorId: session.user.id,
      repostId,
    });
  }

  // Publish to Ably for real-time delivery
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`repost-comments:${repostId}`);
    await channel.publish("new", {
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      author: JSON.stringify(comment.author),
      createdAt: comment.createdAt.toISOString(),
      actorId: session.user.id,
    });

    const count = await prisma.repostComment.count({ where: { repostId } });
    await channel.publish("count", { count });
  } catch {
    // Non-critical — DB write succeeded
  }

  revalidatePath("/feed");
  revalidatePath(`/quote/${repostId}`);
  return { success: true, message: "Comment added" };
}

export async function toggleRepostCommentReaction(data: {
  commentId: string;
  emoji: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { commentId, emoji } = data;

  const comment = await prisma.repostComment.findUnique({
    where: { id: commentId },
    select: { id: true, repostId: true, authorId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }

  const existing = await prisma.repostCommentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId: session.user.id, emoji } },
  });

  if (existing) {
    await prisma.repostCommentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.repostCommentReaction.create({
      data: { commentId, userId: session.user.id, emoji },
    });
  }

  return { success: true, message: existing ? "Reaction removed" : "Reaction added" };
}

export async function editRepostComment(data: {
  commentId: string;
  content: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { commentId, content } = data;
  const trimmed = content.trim();

  if (!trimmed) {
    return { success: false, message: "Comment cannot be empty" };
  }
  if (trimmed.length > 1000) {
    return { success: false, message: "Comment too long (max 1000 characters)" };
  }

  const comment = await prisma.repostComment.findUnique({
    where: { id: commentId },
    select: { id: true, repostId: true, authorId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }
  if (comment.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.repostComment.update({
    where: { id: commentId },
    data: { content: trimmed, editedAt: new Date() },
  });

  revalidatePath(`/quote/${comment.repostId}`);
  revalidatePath("/feed");
  return { success: true, message: "Comment updated" };
}

export async function deleteRepostComment(data: {
  commentId: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const comment = await prisma.repostComment.findUnique({
    where: { id: data.commentId },
    select: { id: true, repostId: true, authorId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }
  if (comment.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.repostComment.delete({ where: { id: data.commentId } });

  revalidatePath(`/quote/${comment.repostId}`);
  revalidatePath("/feed");
  return { success: true, message: "Comment deleted" };
}

// ── Comment reactions ─────────────────────────────────────────────

export async function toggleCommentReaction(data: {
  commentId: string;
  emoji: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { commentId, emoji } = data;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }

  // Toggle: remove if exists, add if not
  const existing = await prisma.commentReaction.findUnique({
    where: {
      commentId_userId_emoji: {
        commentId,
        userId: session.user.id,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({
      data: { commentId, userId: session.user.id, emoji },
    });

    // Notify comment author about the reaction
    if (comment.authorId !== session.user.id) {
      try {
        await createNotification({
          type: "REACTION",
          actorId: session.user.id,
          targetUserId: comment.authorId,
          postId: comment.postId,
          commentId,
        });
      } catch {
        // Non-critical
      }
    }
  }

  // Fetch updated reactions for this comment
  const reactions = await prisma.commentReaction.findMany({
    where: { commentId },
    select: { emoji: true, userId: true },
  });

  // Publish to Ably for real-time updates
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`comments:${comment.postId}`);
    await channel.publish("reaction", {
      commentId,
      reactions: JSON.stringify(groupReactions(reactions)),
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: existing ? "Reaction removed" : "Reaction added" };
}

export async function editComment(data: {
  commentId: string;
  content: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { commentId, content } = data;
  const trimmed = content.trim();

  if (!trimmed) {
    return { success: false, message: "Comment cannot be empty" };
  }
  if (trimmed.length > 1000) {
    return { success: false, message: "Comment too long (max 1000 characters)" };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }
  if (comment.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { content: trimmed, editedAt: new Date() },
  });

  // Publish to Ably for real-time updates
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`comments:${comment.postId}`);
    await channel.publish("edit", {
      commentId,
      content: trimmed,
    });
  } catch {
    // Non-critical
  }

  revalidatePath(`/post/${comment.postId}`);
  revalidatePath("/feed");
  return { success: true, message: "Comment updated" };
}

export async function deleteComment(data: {
  commentId: string;
}): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("post");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const { commentId } = data;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, parentId: true },
  });
  if (!comment) {
    return { success: false, message: "Comment not found" };
  }
  if (comment.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.comment.delete({ where: { id: commentId } });

  // Publish to Ably for real-time updates
  try {
    const ably = getAblyRestClient();
    const channel = ably.channels.get(`comments:${comment.postId}`);
    await channel.publish("delete", {
      commentId,
      parentId: comment.parentId,
    });

    // Also publish updated comment count
    const count = await prisma.comment.count({ where: { postId: comment.postId } });
    await channel.publish("count", { count });
  } catch {
    // Non-critical
  }

  revalidatePath(`/post/${comment.postId}`);
  revalidatePath("/feed");
  return { success: true, message: "Comment deleted" };
}
