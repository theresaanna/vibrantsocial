"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";
import { revalidatePath } from "next/cache";

interface PostState {
  success: boolean;
  message: string;
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

  await prisma.post.create({
    data: { content, authorId: session.user.id, isSensitive, isNsfw },
  });

  revalidatePath("/feed");
  return { success: true, message: "Post created" };
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
      where: { id: { in: toDelete.map((r) => r.id) } },
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

  await prisma.post.update({
    where: { id: postId },
    data: { content, editedAt: new Date() },
  });

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

  await prisma.post.delete({ where: { id: postId } });

  revalidatePath("/feed");
  return { success: true, message: "Post deleted" };
}
