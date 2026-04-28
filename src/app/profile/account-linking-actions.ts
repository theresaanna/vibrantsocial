"use server";

import { auth, signIn } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";import { prisma } from "@/lib/prisma";
import { invalidateLinkedAccountsCacheForGroup } from "@/lib/account-linking-db";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { LinkedAccount } from "@/types/next-auth";

interface AccountLinkingState {
  success: boolean;
  message: string;
  linkedAccounts?: LinkedAccount[];
}

const VALID_OAUTH_PROVIDERS = ["google", "discord"] as const;

export async function startOAuthLink(
  provider: string,
  _formData?: FormData
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  if (!VALID_OAUTH_PROVIDERS.includes(provider as (typeof VALID_OAUTH_PROVIDERS)[number])) {
    return;
  }

  const finishLinkUrl = `/api/finish-link?from=${session.user.id}&provider=${provider}`;
  console.log("[startOAuthLink] userId:", session.user.id, "provider:", provider, "redirectTo:", finishLinkUrl);

  const cookieStore = await cookies();
  cookieStore.set("linkFromUserId", session.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  // Fallback redirect cookie: proxy will redirect to finish-link after
  // the OAuth flow completes, even if NextAuth's callbackUrl cookie is lost.
  cookieStore.set("linkRedirect", finishLinkUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  // Redirect to OAuth provider in the same response that sets the cookie.
  // This uses the server-side signIn which throws a NEXT_REDIRECT.
  // After OAuth, NextAuth will redirect to finish-link which handles
  // account linking with guaranteed cookie access via req.cookies.
  await signIn(provider, { redirectTo: finishLinkUrl });
}

export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  if (!user?.linkedAccountGroupId) return [];

  const members = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: user.linkedAccountGroupId,
      id: { not: session.user.id },
    },
    select: { id: true, username: true, displayName: true, avatar: true, profileFrameId: true, usernameFont: true },
  });

  return members;
}

export async function linkAccount(
  _prevState: AccountLinkingState,
  formData: FormData
): Promise<AccountLinkingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `account-link:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, message: "Email and password are required" };
  }

  // Authenticate the target account
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      passwordHash: true,
      linkedAccountGroupId: true,
    },
  });

  if (!targetUser || !targetUser.passwordHash) {
    return { success: false, message: "Invalid email or password" };
  }

  const isValid = await bcrypt.compare(password, targetUser.passwordHash);
  if (!isValid) {
    return { success: false, message: "Invalid email or password" };
  }

  // Prevent linking to self
  if (targetUser.id === session.user.id) {
    return { success: false, message: "Cannot link to your own account" };
  }

  // Get current user's group
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  const currentGroupId = currentUser?.linkedAccountGroupId;
  const targetGroupId = targetUser.linkedAccountGroupId;

  // Check if already linked
  if (currentGroupId && currentGroupId === targetGroupId) {
    return { success: false, message: "This account is already linked" };
  }

  if (!currentGroupId && !targetGroupId) {
    // Neither has a group — create one and add both
    const group = await prisma.linkedAccountGroup.create({ data: {} });
    await prisma.user.updateMany({
      where: { id: { in: [session.user.id, targetUser.id] } },
      data: { linkedAccountGroupId: group.id },
    });
  } else if (currentGroupId && !targetGroupId) {
    // Current user has a group — add target to it
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { linkedAccountGroupId: currentGroupId },
    });
  } else if (!currentGroupId && targetGroupId) {
    // Target has a group — add current user to it
    await prisma.user.update({
      where: { id: session.user.id },
      data: { linkedAccountGroupId: targetGroupId },
    });
  } else if (currentGroupId && targetGroupId) {
    // Both have groups — merge target's group into current's group
    await prisma.user.updateMany({
      where: { linkedAccountGroupId: targetGroupId },
      data: { linkedAccountGroupId: currentGroupId },
    });
    await prisma.linkedAccountGroup.delete({
      where: { id: targetGroupId },
    });
  }

  // Return updated linked accounts list
  const updatedUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  const linkedAccounts = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: updatedUser!.linkedAccountGroupId!,
      id: { not: session.user.id },
    },
    select: { id: true, username: true, displayName: true, avatar: true, profileFrameId: true, usernameFont: true },
  });

  // Bust the linked-accounts cache for every member of the resulting group
  // so other devices / sessions see the new member without waiting on the
  // 60s TTL.
  await invalidateLinkedAccountsCacheForGroup([session.user.id, targetUser.id]);

  return {
    success: true,
    message: "Account linked successfully",
    linkedAccounts,
  };
}

export async function unlinkAccount(
  targetUserId: string
): Promise<AccountLinkingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `account-link:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  // Verify current user has a group and target is in the same group
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  if (!currentUser?.linkedAccountGroupId) {
    return { success: false, message: "No linked accounts" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, linkedAccountGroupId: true },
  });

  if (
    !targetUser ||
    targetUser.linkedAccountGroupId !== currentUser.linkedAccountGroupId
  ) {
    return { success: false, message: "Account is not in your linked group" };
  }

  // Remove target from group
  await prisma.user.update({
    where: { id: targetUserId },
    data: { linkedAccountGroupId: null },
  });

  // Check remaining members
  const remainingMembers = await prisma.user.count({
    where: { linkedAccountGroupId: currentUser.linkedAccountGroupId },
  });

  if (remainingMembers <= 1) {
    // Only one member left (the current user) — dissolve the group
    await prisma.user.updateMany({
      where: { linkedAccountGroupId: currentUser.linkedAccountGroupId },
      data: { linkedAccountGroupId: null },
    });
    await prisma.linkedAccountGroup.delete({
      where: { id: currentUser.linkedAccountGroupId },
    });
    await invalidateLinkedAccountsCacheForGroup([session.user.id, targetUserId]);
    return { success: true, message: "Account unlinked", linkedAccounts: [] };
  }

  // Return updated list
  const linkedAccounts = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: currentUser.linkedAccountGroupId,
      id: { not: session.user.id },
    },
    select: { id: true, username: true, displayName: true, avatar: true, profileFrameId: true, usernameFont: true },
  });

  // Bust caches for the unlinked user and every remaining group member.
  await invalidateLinkedAccountsCacheForGroup([session.user.id, targetUserId]);

  return { success: true, message: "Account unlinked", linkedAccounts };
}

export async function switchAccount(
  targetUserId: string
): Promise<AccountLinkingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `account-link:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  // Verify group membership
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedAccountGroupId: true },
  });

  if (!currentUser?.linkedAccountGroupId) {
    return { success: false, message: "No linked accounts" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      linkedAccountGroupId: true,
      username: true,
      displayName: true,
    },
  });

  if (
    !targetUser ||
    targetUser.linkedAccountGroupId !== currentUser.linkedAccountGroupId
  ) {
    return { success: false, message: "Account is not in your linked group" };
  }

  // Return success — the client will call update() to swap the JWT
  return {
    success: true,
    message: `Switching to ${targetUser.displayName || targetUser.username}`,
  };
}
