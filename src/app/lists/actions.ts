"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidate, cached, cacheKeys } from "@/lib/cache";
import { getAllBlockRelatedIds } from "@/app/feed/block-actions";
import { getPostInclude, getRepostInclude, PAGE_SIZE } from "@/app/feed/feed-queries";
import { createNotification } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionState {
  success: boolean;
  message: string;
}

const memberUserSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
  profileFrameId: true,
  usernameFont: true,
} as const;

// ---------------------------------------------------------------------------
// CRUD actions
// ---------------------------------------------------------------------------

export async function createList(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `list-create:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `list-member:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
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

  // Check blocks
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: userId },
        { blockerId: userId, blockedId: session.user.id },
      ],
    },
  });
  if (block) {
    return { success: false, message: "Cannot add this user" };
  }

  const existing = await prisma.userListMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  if (existing) {
    return { success: false, message: "User is already in this list" };
  }

  await prisma.userListMember.create({ data: { listId, userId } });

  try {
    await createNotification({
      type: "LIST_ADD",
      actorId: session.user.id,
      targetUserId: userId,
    });
  } catch {
    // Non-critical
  }

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

  const list = await prisma.userList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== session.user.id) {
    return { success: false, message: "List not found or not owned by you" };
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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `list-multi:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  // Verify all lists belong to the user
  const lists = await prisma.userList.findMany({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  const ownedIds = new Set(lists.map((l) => l.id));

  // Check blocks
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: session.user.id },
      ],
    },
  });
  if (block) {
    return { success: false, message: "Cannot add this user" };
  }

  // Get current memberships for this user across all owned lists
  const currentMemberships = await prisma.userListMember.findMany({
    where: { userId: targetUserId, listId: { in: lists.map((l) => l.id) } },
    select: { listId: true },
  });
  const currentListIds = new Set(currentMemberships.map((m) => m.listId));
  const desiredListIds = new Set(listIds.filter((id) => ownedIds.has(id)));

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

  // Notify user if they were added to any new lists
  if (toAdd.length > 0) {
    try {
      await createNotification({
        type: "LIST_ADD",
        actorId: session.user.id,
        targetUserId,
      });
    } catch {
      // Non-critical
    }
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
        include: { user: { select: memberUserSelect } },
        orderBy: { createdAt: "desc" },
      });
    },
    60
  );

  return { list, members };
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

  const lists = await prisma.userList.findMany({
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
  });

  return lists.map((l) => ({
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
      ...memberUserSelect,
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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `list-sub:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

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

  const [currentUser, closeFriendOfRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { showNsfwContent: true, ageVerified: true },
    }),
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }),
  ]);
  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;
  const closeFriendAuthors = [...closeFriendOfRows.map((r: { userId: string }) => r.userId), userId];

  const postInclude = getPostInclude(userId);
  const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
  const fetchCount = PAGE_SIZE + 1;

  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
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

  const [currentUser, closeFriendOfRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { showNsfwContent: true, ageVerified: true },
    }),
    prisma.closeFriend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    }),
  ]);
  const showNsfwContent = currentUser?.showNsfwContent ?? false;
  const ageVerified = !!currentUser?.ageVerified;
  const closeFriendAuthors = [...closeFriendOfRows.map((r: { userId: string }) => r.userId), userId];

  const postInclude = getPostInclude(userId);
  const since = new Date(sinceDate);

  const [posts, reposts] = await Promise.all([
    prisma.post.findMany({
      where: {
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
