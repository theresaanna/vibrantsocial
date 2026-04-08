"use server";

import crypto from "crypto";
import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const MAX_DIGITAL_FILE_SIZE = 200 * 1024 * 1024; // 200MB

interface DigitalFileResult {
  success: boolean;
  message: string;
}

export async function attachDigitalFile(
  marketplacePostId: string,
  fileUrl: string,
  fileName: string,
  fileSize: number,
  isFree: boolean,
): Promise<DigitalFileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `digital-file:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  if (!fileUrl?.trim() || !fileName?.trim()) {
    return { success: false, message: "File URL and name are required" };
  }

  if (fileSize <= 0 || fileSize > MAX_DIGITAL_FILE_SIZE) {
    return { success: false, message: "File must be between 1 byte and 200MB" };
  }

  const marketplacePost = await prisma.marketplacePost.findUnique({
    where: { id: marketplacePostId },
    include: { post: { select: { authorId: true } } },
  });

  if (!marketplacePost || marketplacePost.post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.digitalFile.upsert({
    where: { marketplacePostId },
    create: {
      marketplacePostId,
      fileUrl,
      fileName,
      fileSize,
      isFree,
      couponCode: isFree ? null : generateCouponCode(),
    },
    update: {
      fileUrl,
      fileName,
      fileSize,
      isFree,
      couponCode: isFree ? null : generateCouponCode(),
    },
  });

  return { success: true, message: "Digital file attached" };
}

export async function removeDigitalFile(
  marketplacePostId: string,
): Promise<DigitalFileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const marketplacePost = await prisma.marketplacePost.findUnique({
    where: { id: marketplacePostId },
    include: { post: { select: { authorId: true } } },
  });

  if (!marketplacePost || marketplacePost.post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  await prisma.digitalFile.deleteMany({ where: { marketplacePostId } });

  return { success: true, message: "Digital file removed" };
}

export async function regenerateCouponCode(
  marketplacePostId: string,
): Promise<DigitalFileResult & { couponCode?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const marketplacePost = await prisma.marketplacePost.findUnique({
    where: { id: marketplacePostId },
    include: {
      post: { select: { authorId: true } },
      digitalFile: true,
    },
  });

  if (!marketplacePost || marketplacePost.post.authorId !== session.user.id) {
    return { success: false, message: "Not authorized" };
  }

  if (!marketplacePost.digitalFile) {
    return { success: false, message: "No digital file attached" };
  }

  if (marketplacePost.digitalFile.isFree) {
    return { success: false, message: "Free files do not use coupon codes" };
  }

  const couponCode = generateCouponCode();

  await prisma.digitalFile.update({
    where: { marketplacePostId },
    data: { couponCode },
  });

  return { success: true, message: "Coupon code regenerated", couponCode };
}

export async function redeemCouponAndDownload(
  marketplacePostId: string,
  couponCode: string,
): Promise<DigitalFileResult & { downloadUrl?: string; fileName?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `download:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  if (!couponCode?.trim()) {
    return { success: false, message: "Coupon code is required" };
  }

  const digitalFile = await prisma.digitalFile.findUnique({
    where: { marketplacePostId },
  });

  if (!digitalFile) {
    return { success: false, message: "No digital file found" };
  }

  if (digitalFile.isFree) {
    return { success: false, message: "This file is free to download" };
  }

  if (!digitalFile.couponCode || digitalFile.couponCode !== couponCode.trim()) {
    return { success: false, message: "Invalid coupon code" };
  }

  await prisma.digitalFile.update({
    where: { id: digitalFile.id },
    data: { downloadCount: { increment: 1 } },
  });

  return {
    success: true,
    message: "Coupon redeemed",
    downloadUrl: digitalFile.fileUrl,
    fileName: digitalFile.fileName,
  };
}

export async function downloadFreeFile(
  marketplacePostId: string,
): Promise<DigitalFileResult & { downloadUrl?: string; fileName?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `download:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const digitalFile = await prisma.digitalFile.findUnique({
    where: { marketplacePostId },
  });

  if (!digitalFile) {
    return { success: false, message: "No digital file found" };
  }

  if (!digitalFile.isFree) {
    return { success: false, message: "This file requires a coupon code" };
  }

  await prisma.digitalFile.update({
    where: { id: digitalFile.id },
    data: { downloadCount: { increment: 1 } },
  });

  return {
    success: true,
    message: "Download ready",
    downloadUrl: digitalFile.fileUrl,
    fileName: digitalFile.fileName,
  };
}

export async function fetchDigitalFileInfo(
  marketplacePostId: string,
): Promise<{
  hasFile: boolean;
  fileName?: string;
  fileSize?: number;
  isFree?: boolean;
  couponCode?: string;
  downloadCount?: number;
  isOwner?: boolean;
} | null> {
  const session = await auth();

  const digitalFile = await prisma.digitalFile.findUnique({
    where: { marketplacePostId },
    include: {
      marketplacePost: {
        include: { post: { select: { authorId: true } } },
      },
    },
  });

  if (!digitalFile) {
    return { hasFile: false };
  }

  const isOwner = session?.user?.id === digitalFile.marketplacePost.post.authorId;

  return {
    hasFile: true,
    fileName: digitalFile.fileName,
    fileSize: digitalFile.fileSize,
    isFree: digitalFile.isFree,
    // Only the owner can see the coupon code
    couponCode: isOwner ? (digitalFile.couponCode ?? undefined) : undefined,
    downloadCount: isOwner ? digitalFile.downloadCount : undefined,
    isOwner,
  };
}

function generateCouponCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}
