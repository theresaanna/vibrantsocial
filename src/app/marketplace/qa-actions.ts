"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface QAState {
  success: boolean;
  message: string;
}

export async function askQuestion(
  marketplacePostId: string,
  question: string
): Promise<QAState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `marketplace-qa:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const trimmed = question.trim();
  if (!trimmed || trimmed.length < 5) {
    return { success: false, message: "Question must be at least 5 characters" };
  }

  if (trimmed.length > 1000) {
    return { success: false, message: "Question must be under 1000 characters" };
  }

  const marketplacePost = await prisma.marketplacePost.findUnique({
    where: { id: marketplacePostId },
    select: { id: true, post: { select: { authorId: true } } },
  });

  if (!marketplacePost) {
    return { success: false, message: "Listing not found" };
  }

  await prisma.marketplaceQuestion.create({
    data: {
      marketplacePostId,
      askerId: session.user.id,
      question: trimmed,
    },
  });

  revalidatePath("/marketplace");
  return { success: true, message: "Question submitted" };
}

export async function answerQuestion(
  questionId: string,
  answer: string
): Promise<QAState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `marketplace-qa:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const trimmed = answer.trim();
  if (!trimmed) {
    return { success: false, message: "Answer is required" };
  }

  if (trimmed.length > 2000) {
    return { success: false, message: "Answer must be under 2000 characters" };
  }

  const question = await prisma.marketplaceQuestion.findUnique({
    where: { id: questionId },
    include: {
      marketplacePost: {
        select: { post: { select: { authorId: true } } },
      },
    },
  });

  if (!question) {
    return { success: false, message: "Question not found" };
  }

  // Only the post author can answer
  if (question.marketplacePost.post.authorId !== session.user.id) {
    return { success: false, message: "Only the seller can answer questions" };
  }

  await prisma.marketplaceQuestion.update({
    where: { id: questionId },
    data: {
      answer: trimmed,
      answeredAt: new Date(),
    },
  });

  revalidatePath("/marketplace");
  return { success: true, message: "Answer posted" };
}

export async function deleteQuestion(questionId: string): Promise<QAState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const question = await prisma.marketplaceQuestion.findUnique({
    where: { id: questionId },
    include: {
      marketplacePost: {
        select: { post: { select: { authorId: true } } },
      },
    },
  });

  if (!question) {
    return { success: false, message: "Question not found" };
  }

  // Asker or post author can delete
  const isAsker = question.askerId === session.user.id;
  const isAuthor = question.marketplacePost.post.authorId === session.user.id;

  if (!isAsker && !isAuthor) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.marketplaceQuestion.delete({ where: { id: questionId } });

  revalidatePath("/marketplace");
  return { success: true, message: "Question deleted" };
}

export interface MarketplaceQuestionData {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  asker: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    image: string | null;
    profileFrameId: string | null;
  };
}

export async function getQuestions(
  marketplacePostId: string
): Promise<MarketplaceQuestionData[]> {
  const questions = await prisma.marketplaceQuestion.findMany({
    where: { marketplacePostId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      question: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
      asker: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          image: true,
          profileFrameId: true,
        },
      },
    },
  });

  return questions.map((q) => ({
    ...q,
    answeredAt: q.answeredAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
  }));
}
