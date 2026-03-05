"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
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

  await prisma.post.create({
    data: { content, authorId: session.user.id },
  });

  revalidatePath("/feed");
  return { success: true, message: "Post created" };
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
