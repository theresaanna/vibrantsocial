"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { LinkedAccount } from "@/types/next-auth";

interface AccountLinkingState {
  success: boolean;
  message: string;
  linkedAccounts?: LinkedAccount[];
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
    select: { id: true, username: true, displayName: true, avatar: true },
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
    select: { id: true, username: true, displayName: true, avatar: true },
  });

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
    return { success: true, message: "Account unlinked", linkedAccounts: [] };
  }

  // Return updated list
  const linkedAccounts = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: currentUser.linkedAccountGroupId,
      id: { not: session.user.id },
    },
    select: { id: true, username: true, displayName: true, avatar: true },
  });

  return { success: true, message: "Account unlinked", linkedAccounts };
}

export async function switchAccount(
  targetUserId: string
): Promise<AccountLinkingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
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
