"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { revalidatePath } from "next/cache";
import {
  extractMentionsFromLexicalJson,
  createMentionNotifications,
} from "@/lib/mentions";
import { extractTagsFromNames } from "@/lib/tags";
import { invalidate, cacheKeys } from "@/lib/cache";
import { notifyPostSubscribers } from "@/lib/subscription-notifications";
import { notifyTagSubscribers } from "@/lib/tag-subscription-notifications";

interface PostState {
  success: boolean;
  message: string;
  postId?: string;
}

export async function createPost(
  _prevState: PostState,
  formData: FormData
): Promise<PostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const isVerified = await requirePhoneVerification(session.user.id);
  if (!isVerified) {
    return {
      success: false,
      message: "Phone verification required to post",
    };
  }

  const isOldEnough = await requireMinimumAge(session.user.id, 18);
  if (!isOldEnough) {
    return {
      success: false,
      message: "You must be 18 or older to post",
    };
  }

  const content = formData.get("content") as string;
  if (!content) {
    return { success: false, message: "Post content is required" };
  }

  try {
    const parsed = JSON.parse(content);
    // Check that the Lexical JSON has actual text content
    const text = JSON.stringify(parsed);
    if (text.length < 50) {
      return { success: false, message: "Post cannot be empty" };
    }
  } catch {
    return { success: false, message: "Invalid post content" };
  }

  const isSensitive = formData.get("isSensitive") === "true";
  const isNsfw = formData.get("isNsfw") === "true";
  const isGraphicNudity = formData.get("isGraphicNudity") === "true";
  const isCloseFriendsOnly = formData.get("isCloseFriendsOnly") === "true";

  const post = await prisma.post.create({
    data: { content, authorId: session.user.id, isSensitive, isNsfw, isGraphicNudity, isCloseFriendsOnly },
  });

  // Attach tags (skip for sensitive/graphic posts; NSFW posts can have tags)
  const rawTags = formData.get("tags") as string;
  const createdTagIds: string[] = [];
  const createdTagNames: string[] = [];
  if (rawTags && !isSensitive && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags.split(","));
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.postTag.create({
        data: { postId: post.id, tagId: tag.id },
      });
      createdTagIds.push(tag.id);
      createdTagNames.push(name);
    }
    // Invalidate tag caches
    if (isNsfw) {
      await invalidate(cacheKeys.nsfwTagCloud());
    } else {
      await invalidate(cacheKeys.tagCloud());
    }
    await Promise.all(
      tagNames.map((name) => invalidate(cacheKeys.tagPostCount(name)))
    );
  }

  // Send mention notifications
  const mentionedUsernames = extractMentionsFromLexicalJson(content);
  if (mentionedUsernames.length > 0) {
    await createMentionNotifications({
      usernames: mentionedUsernames,
      actorId: session.user.id,
      postId: post.id,
    });
  }

  // Notify post subscribers
  await notifyPostSubscribers({
    authorId: session.user.id,
    postId: post.id,
    isSensitive,
    isNsfw,
    isGraphicNudity,
    isCloseFriendsOnly,
  });

  // Notify tag subscribers
  if (createdTagIds.length > 0) {
    await notifyTagSubscribers({
      authorId: session.user.id,
      postId: post.id,
      tagIds: createdTagIds,
      tagNames: createdTagNames,
      isSensitive,
      isNsfw,
      isGraphicNudity,
      isCloseFriendsOnly,
    });
  }

  revalidatePath("/feed");
  return { success: true, message: "Post created", postId: post.id };
}

const MAX_POST_REVISIONS = 20;

async function prunePostRevisions(postId: string) {
  const count = await prisma.postRevision.count({ where: { postId } });
  if (count > MAX_POST_REVISIONS) {
    const toDelete = await prisma.postRevision.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      take: count - MAX_POST_REVISIONS,
      select: { id: true },
    });
    await prisma.postRevision.deleteMany({
      where: { id: { in: toDelete.map((r: { id: string }) => r.id) } },
    });
  }
}

export async function editPost(
  _prevState: PostState,
  formData: FormData
): Promise<PostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  const content = formData.get("content") as string;
  if (!postId || !content) {
    return { success: false, message: "Post ID and content required" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  // Save current content as a revision
  await prisma.postRevision.create({
    data: { postId, content: post.content },
  });
  await prunePostRevisions(postId);

  const isSensitive = formData.get("isSensitive") === "true";
  const isNsfw = formData.get("isNsfw") === "true";
  const isGraphicNudity = formData.get("isGraphicNudity") === "true";
  const isCloseFriendsOnly = formData.get("isCloseFriendsOnly") === "true";

  await prisma.post.update({
    where: { id: postId },
    data: { content, editedAt: new Date(), isSensitive, isNsfw, isGraphicNudity, isCloseFriendsOnly },
  });

  // Update tags
  const rawTags = formData.get("tags") as string;
  // Delete existing tags first
  await prisma.postTag.deleteMany({ where: { postId } });
  // Re-create if not sensitive/graphic (NSFW posts can have tags)
  if (rawTags && !isSensitive && !isGraphicNudity) {
    const tagNames = extractTagsFromNames(rawTags.split(","));
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await prisma.postTag.create({
        data: { postId, tagId: tag.id },
      });
    }
    // Invalidate tag caches
    if (isNsfw) {
      await invalidate(cacheKeys.nsfwTagCloud());
    } else {
      await invalidate(cacheKeys.tagCloud());
    }
    await Promise.all(
      tagNames.map((name) => invalidate(cacheKeys.tagPostCount(name)))
    );
  } else {
    // Tags were removed — invalidate both clouds
    await invalidate(cacheKeys.tagCloud());
    await invalidate(cacheKeys.nsfwTagCloud());
  }

  // Notify users who were newly mentioned in the edit
  const oldMentions = new Set(extractMentionsFromLexicalJson(post.content));
  const newMentions = extractMentionsFromLexicalJson(content).filter(
    (u) => !oldMentions.has(u)
  );
  if (newMentions.length > 0) {
    await createMentionNotifications({
      usernames: newMentions,
      actorId: session.user.id,
      postId,
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  return { success: true, message: "Post updated" };
}

export async function getPostRevisions(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post || post.authorId !== session.user.id) return [];

  return prisma.postRevision.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    take: MAX_POST_REVISIONS,
    select: { id: true, content: true, createdAt: true },
  });
}

interface RestoreState {
  success: boolean;
  message: string;
  restoredContent?: string;
}

export async function restorePostRevision(
  revisionId: string
): Promise<RestoreState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const revision = await prisma.postRevision.findUnique({
    where: { id: revisionId },
    include: { post: { select: { authorId: true, id: true, content: true } } },
  });

  if (!revision || revision.post.authorId !== session.user.id) {
    return { success: false, message: "Revision not found" };
  }

  // Save current content as a revision before restoring
  await prisma.postRevision.create({
    data: { postId: revision.post.id, content: revision.post.content },
  });
  await prunePostRevisions(revision.post.id);

  await prisma.post.update({
    where: { id: revision.post.id },
    data: { content: revision.content, editedAt: new Date() },
  });

  revalidatePath("/feed");
  revalidatePath(`/post/${revision.post.id}`);
  return {
    success: true,
    message: "Post restored",
    restoredContent: revision.content,
  };
}

export async function updatePostChecklist(
  postId: string,
  content: string
): Promise<PostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.post.update({
    where: { id: postId },
    data: { content },
  });

  return { success: true, message: "Checklist updated" };
}

export async function deletePost(
  _prevState: PostState,
  formData: FormData
): Promise<PostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  if (!postId) {
    return { success: false, message: "Post ID required" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  // Get tags before deleting so we can invalidate their caches
  const postTags = await prisma.postTag.findMany({
    where: { postId },
    include: { tag: { select: { name: true } } },
  });

  await prisma.post.delete({ where: { id: postId } });

  // Invalidate tag caches if the post had tags
  if (postTags.length > 0) {
    await invalidate(cacheKeys.tagCloud());
    await Promise.all(
      postTags.map((pt) => invalidate(cacheKeys.tagPostCount(pt.tag.name)))
    );
  }

  revalidatePath("/feed");
  return { success: true, message: "Post deleted" };
}

export async function togglePinPost(
  _prevState: PostState,
  formData: FormData
): Promise<PostState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const postId = formData.get("postId") as string;
  if (!postId) {
    return { success: false, message: "Post ID required" };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  if (post.isPinned) {
    await prisma.post.update({
      where: { id: postId },
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
    await prisma.post.update({
      where: { id: postId },
      data: { isPinned: true },
    });
  }

  revalidatePath("/feed");
  revalidatePath(`/post/${postId}`);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });
  if (user?.username) {
    revalidatePath(`/${user.username}`);
  }

  return {
    success: true,
    message: post.isPinned ? "Post unpinned" : "Post pinned",
  };
}
