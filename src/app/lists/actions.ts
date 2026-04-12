"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { inngest } from "@/lib/inngest";
import { invalidate, cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getPostInclude, getRepostInclude, PAGE_SIZE, publishedOnly } from "@/app/feed/feed-queries";
import {
  requireAuthWithRateLimit,
  isActionError,
  hasBlock,
  createNotificationSafe,
  USER_PROFILE_SELECT,
} from "@/lib/action-utils";
import type { ActionState } from "@/lib/action-utils";
import { getUserPrefs } from "@/lib/user-prefs";
import { getCachedCloseFriendOfIds } from "@/app/feed/close-friends-actions";

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

async function isOwnerOrCollaborator(
  listId: string,
  userId: string
): Promise<"owner" | "collaborator" | false> {
  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) return false;
  if (list.ownerId === userId) return "owner";
  const collab = await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  return collab ? "collaborator" : false;
}

// ---------------------------------------------------------------------------
// CRUD actions
// ---------------------------------------------------------------------------

export async function createList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-create");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 1 || name.length > 50) {
    return { success: false, message: "List name must be between 1 and 50 characters" };
  }

  const existing = await prisma.userList.findUnique({
    where: { ownerId_name: { ownerId: session.user.id, name } },
  });
  if (existing) {
    return { success: false, message: "You already have a list with that name" };
  }

  await prisma.userList.create({
    data: { name, ownerId: session.user.id },
  });

  await invalidate(cacheKeys.userLists(session.user.id));
  revalidatePath("/lists");
  revalidatePath("/feed");

  return { success: true, message: "List created" };
}

export async function deleteList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const listId = formData.get("listId") as string;
  if (!listId) {
    return { success: false, message: "Missing list ID" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  await prisma.userList.delete({ where: { id: listId } });

  await Promise.all([
    invalidate(cacheKeys.userLists(session.user.id)),
    invalidate(cacheKeys.userListMembers(listId)),
  ]);
  revalidatePath("/lists");
  revalidatePath("/feed");

  return { success: true, message: "List deleted" };
}

export async function renameList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const listId = formData.get("listId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!listId || !name || name.length < 1 || name.length > 50) {
    return { success: false, message: "Invalid input" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  const duplicate = await prisma.userList.findUnique({
    where: { ownerId_name: { ownerId: session.user.id, name } },
  });
  if (duplicate && duplicate.id !== listId) {
    return { success: false, message: "You already have a list with that name" };
  }

  await prisma.userList.update({ where: { id: listId }, data: { name } });
  await invalidate(cacheKeys.userLists(session.user.id));
  revalidatePath("/lists");

  return { success: true, message: "List renamed" };
}

export async function addMemberToList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-member");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const listId = formData.get("listId") as string;
  const userId = formData.get("userId") as string;
  if (!listId || !userId) {
    return { success: false, message: "Missing required fields" };
  }

  const role = await isOwnerOrCollaborator(listId, session.user.id);
  if (!role) {
    return { success: false, message: "List not found or you don't have permission" };
  }

  if (await hasBlock(session.user.id, userId)) {
    return { success: false, message: "Cannot add this user" };
  }

  const existing = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (existing) {
    return { success: false, message: "User is already in this list" };
  }

  await prisma.userListMember.create({ data: { listId, userId } });

  await createNotificationSafe({
    type: "LIST_ADD",
    actorId: session.user.id,
    targetUserId: userId,
    userListId: listId,
  });

  await invalidate(cacheKeys.userListMembers(listId));
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/feed");

  return { success: true, message: "Member added" };
}

export async function removeMemberFromList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const listId = formData.get("listId") as string;
  const userId = formData.get("userId") as string;
  if (!listId || !userId) {
    return { success: false, message: "Missing required fields" };
  }

  const role = await isOwnerOrCollaborator(listId, session.user.id);
  if (!role) {
    return { success: false, message: "List not found or you don't have permission" };
  }

  const member = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (!member) {
    return { success: false, message: "User is not in this list" };
  }

  await prisma.userListMember.delete({ where: { id: member.id } });
  await invalidate(cacheKeys.userListMembers(listId));
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/feed");

  return { success: true, message: "Member removed" };
}

export async function addUserToMultipleLists(
  listIds: string[],
  targetUserId: string
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-multi");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  // Verify all lists belong to the user or they collaborate on
  const [ownedLists, collaboratingLists] = await Promise.all([
    prisma.userList.findMany({
      where: { ownerId: session.user.id },
      select: { id: true },
    }),
    prisma.userListCollaborator.findMany({
      where: { userId: session.user.id },
      select: { listId: true },
    }),
  ]);
  const allowedIds = new Set([
    ...ownedLists.map((l) => l.id),
    ...collaboratingLists.map((c) => c.listId),
  ]);

  if (await hasBlock(session.user.id, targetUserId)) {
    return { success: false, message: "Cannot add this user" };
  }

  // Get current memberships for this user across all allowed lists
  const allAllowedIds = [...allowedIds];
  const currentMemberships = await prisma.userListMember.findMany({
    where: { userId: targetUserId, listId: { in: allAllowedIds } },
    select: { listId: true },
  });
  const currentListIds = new Set(currentMemberships.map((m) => m.listId));
  const desiredListIds = new Set(listIds.filter((id) => allowedIds.has(id)));

  // Add to new lists
  const toAdd = [...desiredListIds].filter((id) => !currentListIds.has(id));
  // Remove from lists no longer selected
  const toRemove = [...currentListIds].filter((id) => !desiredListIds.has(id));

  const operations: Promise<unknown>[] = [];
  for (const listId of toAdd) {
    operations.push(
      prisma.userListMember.create({ data: { listId, userId: targetUserId } })
    );
  }
  for (const listId of toRemove) {
    operations.push(
      prisma.userListMember.delete({
        where: { listId_userId: { listId, userId: targetUserId } },
      })
    );
  }
  await Promise.all(operations);

  // Notify user for each new list they were added to
  for (const listId of toAdd) {
    await createNotificationSafe({
      type: "LIST_ADD",
      actorId: session.user.id,
      targetUserId,
      userListId: listId,
    });
  }

  // Invalidate caches for all affected lists
  const allAffected = [...new Set([...toAdd, ...toRemove])];
  await Promise.all([
    invalidate(cacheKeys.userLists(session.user.id)),
    ...allAffected.map((id) => invalidate(cacheKeys.userListMembers(id))),
  ]);
  revalidatePath("/feed");

  return { success: true, message: "Lists updated" };
}

// ---------------------------------------------------------------------------
// Query actions
// ---------------------------------------------------------------------------

export async function getUserLists() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return cached(
    cacheKeys.userLists(session.user.id),
    async () => {
      return prisma.userList.findMany({
        where: { ownerId: session.user.id },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: "asc" },
      });
    },
    60
  );
}

export async function getCollaboratingLists() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.userList.findMany({
    where: {
      collaborators: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { members: true } },
      owner: { select: { username: true, displayName: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getListMembers(listId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await prisma.userList.findUnique({
    where: { id: listId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!list) return null;

  const members = await cached(
    cacheKeys.userListMembers(listId),
    async () => {
      return prisma.userListMember.findMany({
        where: { listId },
        include: { user: { select: USER_PROFILE_SELECT } },
        orderBy: { createdAt: "desc" },
      });
    },
    60
  );

  const isCollaborator = list.ownerId !== session.user.id
    ? !!(await prisma.userListCollaborator.findUnique({
        where: { listId_userId: { listId, userId: session.user.id } },
      }))
    : false;

  return { list, members, isCollaborator };
}

export async function getListsForUser(userId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.userList.findMany({
    where: { ownerId: userId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserListMemberships(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Get lists the user owns or collaborates on
  const [ownedLists, collaborations] = await Promise.all([
    prisma.userList.findMany({
      where: { ownerId: session.user.id },
      select: {
        id: true,
        name: true,
        members: {
          where: { userId: targetUserId },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userListCollaborator.findMany({
      where: { userId: session.user.id },
      select: {
        list: {
          select: {
            id: true,
            name: true,
            members: {
              where: { userId: targetUserId },
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  const collabLists = collaborations.map((c) => c.list);
  const allLists = [...ownedLists, ...collabLists];

  return allLists.map((l) => ({
    id: l.id,
    name: l.name,
    isMember: l.members.length > 0,
  }));
}

export async function searchUsersForList(listId: string, query: string) {
  const session = await auth();
  if (!session?.user?.id) return { users: [], hasMore: false };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { users: [], hasMore: false };

  const blockedIds = await getAllBlockRelatedIds(session.user.id);
  const fetchCount = PAGE_SIZE + 1;

  const users = await prisma.user.findMany({
    where: {
      ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      ...USER_PROFILE_SELECT,
      userListMembers: {
        where: { listId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
  });

  const hasMore = users.length > PAGE_SIZE;
  return {
    users: users.slice(0, PAGE_SIZE).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      name: u.name,
      avatar: u.avatar,
      image: u.image,
      profileFrameId: u.profileFrameId,
      usernameFont: u.usernameFont,
      isInList: u.userListMembers.length > 0,
    })),
    hasMore,
  };
}

// ---------------------------------------------------------------------------
// Feed actions (mirror feed-actions.ts but scoped to list members)
// ---------------------------------------------------------------------------
// Subscription actions
// ---------------------------------------------------------------------------

export async function toggleListSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-sub");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const listId = formData.get("listId") as string;
  if (!listId) {
    return { success: false, message: "Missing list ID" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) {
    return { success: false, message: "List not found" };
  }

  // Can't subscribe to your own list
  if (list.ownerId === session.user.id) {
    return { success: false, message: "You own this list" };
  }

  const existing = await prisma.userListSubscription.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.userListSubscription.delete({ where: { id: existing.id } });
  } else {
    await prisma.userListSubscription.create({
      data: { listId, userId: session.user.id },
    });

    // Notify the list owner that someone subscribed
    await createNotificationSafe({
      type: "LIST_SUBSCRIBE",
      actorId: session.user.id,
      targetUserId: list.ownerId,
    });
  }

  await invalidate(cacheKeys.userListSubscriptions(session.user.id));
  revalidatePath("/feed");

  return { success: true, message: existing ? "Unsubscribed" : "Subscribed" };
}

export async function getSubscribedLists() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return cached(
    cacheKeys.userListSubscriptions(session.user.id),
    async () => {
      const subs = await prisma.userListSubscription.findMany({
        where: { userId: session.user.id },
        include: {
          list: {
            include: {
              owner: { select: { username: true } },
              _count: { select: { members: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return subs.map((s) => ({
        id: s.list.id,
        name: s.list.name,
        ownerUsername: s.list.owner.username,
      }));
    },
    60
  );
}

export async function isSubscribedToList(listId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const sub = await prisma.userListSubscription.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  return !!sub;
}

export async function getListInfo(listId: string) {
  const list = await prisma.userList.findUnique({
    where: { id: listId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      owner: { select: { username: true } },
    },
  });
  return list;
}

// ---------------------------------------------------------------------------
// Collaborator actions
// ---------------------------------------------------------------------------

export async function addCollaboratorToList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-collab");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const listId = formData.get("listId") as string;
  const userId = formData.get("userId") as string;
  if (!listId || !userId) {
    return { success: false, message: "Missing required fields" };
  }

  if (userId === session.user.id) {
    return { success: false, message: "You cannot add yourself as a collaborator" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  if (await hasBlock(session.user.id, userId)) {
    return { success: false, message: "Cannot add this user" };
  }

  const existing = await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (existing) {
    return { success: false, message: "User is already a collaborator" };
  }

  await prisma.userListCollaborator.create({ data: { listId, userId } });

  await createNotificationSafe({
    type: "LIST_COLLABORATOR_ADD",
    actorId: session.user.id,
    targetUserId: userId,
    userListId: listId,
  });

  await invalidate(cacheKeys.userListCollaborators(listId));
  revalidatePath(`/lists/${listId}`);

  return { success: true, message: "Collaborator added" };
}

export async function removeCollaboratorFromList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const listId = formData.get("listId") as string;
  const userId = formData.get("userId") as string;
  if (!listId || !userId) {
    return { success: false, message: "Missing required fields" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
  }

  const collab = await prisma.userListCollaborator.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (!collab) {
    return { success: false, message: "User is not a collaborator" };
  }

  await prisma.userListCollaborator.delete({ where: { id: collab.id } });
  await invalidate(cacheKeys.userListCollaborators(listId));
  revalidatePath(`/lists/${listId}`);

  return { success: true, message: "Collaborator removed" };
}

export async function getListCollaborators(listId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return cached(
    cacheKeys.userListCollaborators(listId),
    async () => {
      const collabs = await prisma.userListCollaborator.findMany({
        where: { listId },
        include: { user: { select: USER_PROFILE_SELECT } },
        orderBy: { createdAt: "desc" },
      });
      return collabs.map((c) => ({
        id: c.id,
        userId: c.userId,
        user: c.user,
      }));
    },
    60
  );
}

export async function searchUsersForCollaborator(listId: string, query: string) {
  const session = await auth();
  if (!session?.user?.id) return { users: [], hasMore: false };

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return { users: [], hasMore: false };

  const blockedIds = await getAllBlockRelatedIds(session.user.id);
  const fetchCount = PAGE_SIZE + 1;

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: [...blockedIds, session.user.id] },
      OR: [
        { username: { contains: trimmed, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
        { name: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      ...USER_PROFILE_SELECT,
      userListCollaborations: {
        where: { listId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: fetchCount,
  });

  const hasMore = users.length > PAGE_SIZE;
  return {
    users: users.slice(0, PAGE_SIZE).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      name: u.name,
      avatar: u.avatar,
      image: u.image,
      profileFrameId: u.profileFrameId,
      usernameFont: u.usernameFont,
      isCollaborator: u.userListCollaborations.length > 0,
    })),
    hasMore,
  };
}

// ---------------------------------------------------------------------------
// Join request actions
// ---------------------------------------------------------------------------

export async function requestToJoinList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-join");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const listId = formData.get("listId") as string;
  if (!listId) {
    return { success: false, message: "Missing list ID" };
  }

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list) {
    return { success: false, message: "List not found" };
  }

  if (list.ownerId === session.user.id) {
    return { success: false, message: "You own this list" };
  }

  if (await hasBlock(session.user.id, list.ownerId)) {
    return { success: false, message: "Cannot request to join this list" };
  }

  // Check if already a member
  const existingMember = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (existingMember) {
    return { success: false, message: "You are already in this list" };
  }

  // Check for existing pending request
  const existingRequest = await prisma.userListJoinRequest.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (existingRequest) {
    if (existingRequest.status === "PENDING") {
      return { success: false, message: "Request already pending" };
    }
    // If previously declined, allow re-request by updating status
    await prisma.userListJoinRequest.update({
      where: { id: existingRequest.id },
      data: { status: "PENDING" },
    });
  } else {
    await prisma.userListJoinRequest.create({
      data: { listId, userId: session.user.id },
    });
  }

  // Notify only the list owner (not collaborators)
  await createNotificationSafe({
    type: "LIST_JOIN_REQUEST",
    actorId: session.user.id,
    targetUserId: list.ownerId,
    userListId: listId,
  });

  // Send email notification to list owner
  try {
    const [owner, requester] = await Promise.all([
      prisma.user.findUnique({
        where: { id: list.ownerId },
        select: { email: true, emailOnListJoinRequest: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, username: true, name: true },
      }),
    ]);

    if (owner?.email && owner.emailOnListJoinRequest) {
      const requesterName =
        requester?.displayName ?? requester?.username ?? requester?.name ?? "Someone";
      await inngest.send({
        name: "email/list-join-request",
        data: { toEmail: owner.email, requesterName, listName: list.name },
      });
    }
  } catch {
    // Non-critical
  }

  revalidatePath("/notifications");
  return { success: true, message: "Join request sent" };
}

export async function approveListJoinRequest(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-join");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const requestId = formData.get("requestId") as string;
  if (!requestId) {
    return { success: false, message: "Missing request ID" };
  }

  const request = await prisma.userListJoinRequest.findUnique({
    where: { id: requestId },
    include: { list: { select: { id: true, ownerId: true } } },
  });
  if (!request) {
    return { success: false, message: "Request not found" };
  }

  // Only the list owner can approve (not collaborators)
  if (request.list.ownerId !== session.user.id) {
    return { success: false, message: "Only the list owner can approve requests" };
  }

  if (request.status !== "PENDING") {
    return { success: false, message: "Request already handled" };
  }

  // Approve: update request status and add as member
  await Promise.all([
    prisma.userListJoinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    }),
    prisma.userListMember.create({
      data: { listId: request.listId, userId: request.userId },
    }),
  ]);

  await createNotificationSafe({
    type: "LIST_ADD",
    actorId: session.user.id,
    targetUserId: request.userId,
    userListId: request.listId,
  });

  await invalidate(cacheKeys.userListMembers(request.listId));
  revalidatePath(`/lists/${request.listId}`);
  revalidatePath("/notifications");

  return { success: true, message: "Request approved" };
}

export async function declineListJoinRequest(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-join");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const requestId = formData.get("requestId") as string;
  if (!requestId) {
    return { success: false, message: "Missing request ID" };
  }

  const request = await prisma.userListJoinRequest.findUnique({
    where: { id: requestId },
    include: { list: { select: { id: true, ownerId: true } } },
  });
  if (!request) {
    return { success: false, message: "Request not found" };
  }

  // Only the list owner can decline (not collaborators)
  if (request.list.ownerId !== session.user.id) {
    return { success: false, message: "Only the list owner can decline requests" };
  }

  if (request.status !== "PENDING") {
    return { success: false, message: "Request already handled" };
  }

  await prisma.userListJoinRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED" },
  });

  revalidatePath("/notifications");
  return { success: true, message: "Request declined" };
}

export async function respondToListJoinRequestByActor(
  actorId: string,
  listId: string,
  action: "approve" | "decline"
): Promise<ActionState> {
  const authResult = await requireAuthWithRateLimit("list-join");
  if (isActionError(authResult)) return authResult;
  const session = authResult;

  const request = await prisma.userListJoinRequest.findFirst({
    where: {
      userId: actorId,
      listId,
      status: "PENDING",
    },
    include: { list: { select: { id: true, ownerId: true } } },
  });

  if (!request) {
    return { success: false, message: "No pending join request found" };
  }

  if (request.list.ownerId !== session.user.id) {
    return { success: false, message: "Only the list owner can respond to requests" };
  }

  if (action === "approve") {
    await Promise.all([
      prisma.userListJoinRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      }),
      prisma.userListMember.create({
        data: { listId: request.listId, userId: request.userId },
      }),
    ]);

    await createNotificationSafe({
      type: "LIST_ADD",
      actorId: session.user.id,
      targetUserId: request.userId,
      userListId: request.listId,
    });

    await invalidate(cacheKeys.userListMembers(request.listId));
    revalidatePath(`/lists/${request.listId}`);
    revalidatePath("/notifications");
    return { success: true, message: "Request approved" };
  }

  // Decline
  await prisma.userListJoinRequest.update({
    where: { id: request.id },
    data: { status: "DECLINED" },
  });

  revalidatePath("/notifications");
  return { success: true, message: "Request declined" };
}

export async function getListJoinRequestStatus(
  listId: string
): Promise<"none" | "pending" | "approved" | "declined"> {
  const session = await auth();
  if (!session?.user?.id) return "none";

  const request = await prisma.userListJoinRequest.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
    select: { status: true },
  });

  if (!request) return "none";
  return request.status.toLowerCase() as "pending" | "approved" | "declined";
}

// ---------------------------------------------------------------------------
// Feed actions (mirror feed-actions.ts but scoped to list members)
// ---------------------------------------------------------------------------

async function getListMemberIds(listId: string): Promise<string[]> {
  return cached(
    cacheKeys.userListMembers(listId) + ":ids",
    async () => {
      const members = await prisma.userListMember.findMany({
        where: { listId },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    },
    60
  );
}

export async function fetchListFeedPage(listId: string, cursor?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { items: [] as ReturnType<typeof JSON.parse>[], hasMore: false };
  }

  const userId = session.user.id;

  const [allMemberIds, blockedIds] = await Promise.all([
    getListMemberIds(listId),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const memberIds = allMemberIds.filter((id: string) => !blockedSet.has(id));

  if (memberIds.length === 0) {
    return { items: [], hasMore: false };
  }

  const [prefs, closeFriendOfIds] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);
  const { showNsfwContent, ageVerified } = prefs;
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...publishedOnly,
        authorId: { in: memberIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
        OR: [
          { isCloseFriendsOnly: false, hasCustomAudience: false },
          { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
          { hasCustomAudience: true, audience: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: memberIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        OR: [
          { isCloseFriendsOnly: false },
          { isCloseFriendsOnly: true, userId: { in: closeFriendAuthors } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: getRepostInclude(userId),
    }),
  ]);

  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  const allItems = [
    ...posts.map((p: { createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r: { createdAt: Date }) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasMore = allItems.length > PAGE_SIZE;
  const items = allItems.slice(0, PAGE_SIZE);

  return { items, hasMore };
}

export async function fetchNewListFeedItems(listId: string, sinceDate: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  const [allMemberIds, blockedIds] = await Promise.all([
    getListMemberIds(listId),
    getAllBlockRelatedIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const memberIds = allMemberIds.filter((id: string) => !blockedSet.has(id));

  if (memberIds.length === 0) return [];

  const [prefs, closeFriendOfIds] = await Promise.all([
    getUserPrefs(userId),
    getCachedCloseFriendOfIds(userId),
  ]);
  const { showNsfwContent, ageVerified } = prefs;
  const closeFriendAuthors = [...closeFriendOfIds, userId];

  const postInclude = getPostInclude(userId);
  const since = new Date(sinceDate);

  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...publishedOnly,
        authorId: { in: memberIds },
        createdAt: { gt: since },
        ...(!showNsfwContent ? { isNsfw: false } : {}),
        ...(!ageVerified ? { isSensitive: false, isGraphicNudity: false } : {}),
        OR: [
          { isCloseFriendsOnly: false, hasCustomAudience: false },
          { isCloseFriendsOnly: true, authorId: { in: closeFriendAuthors } },
          { hasCustomAudience: true, audience: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: postInclude,
    }),
    prisma.repost.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gt: since },
        OR: [
          { isCloseFriendsOnly: false },
          { isCloseFriendsOnly: true, userId: { in: closeFriendAuthors } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: getRepostInclude(userId),
    }),
  ]);

  const directPostIds = new Set(posts.map((p: { id: string }) => p.id));
  const filteredReposts = reposts.filter(
    (r: { content?: string | null; post: { id: string } }) =>
      r.content != null || !directPostIds.has(r.post.id)
  );

  return [
    ...posts.map((p: { createdAt: Date }) => ({
      type: "post" as const,
      data: JSON.parse(JSON.stringify(p)),
      date: p.createdAt.toISOString(),
    })),
    ...filteredReposts.map((r: { createdAt: Date }) => ({
      type: "repost" as const,
      data: JSON.parse(JSON.stringify(r)),
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
