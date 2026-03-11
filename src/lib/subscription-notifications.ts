import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";

interface NotifyPostSubscribersParams {
  authorId: string;
  postId: string;
  isSensitive?: boolean;
  isNsfw?: boolean;
  isGraphicNudity?: boolean;
  isCloseFriendsOnly?: boolean;
}

/**
 * Notify all users subscribed to the author's posts.
 * Skips notifications for sensitive/NSFW/graphic content.
 * For close-friends-only posts, only notifies subscribers who are on the author's close friends list.
 */
export async function notifyPostSubscribers(params: NotifyPostSubscribersParams) {
  const {
    authorId,
    postId,
    isSensitive = false,
    isNsfw = false,
    isGraphicNudity = false,
    isCloseFriendsOnly = false,
  } = params;

  // Don't notify for sensitive/flagged content
  if (isSensitive || isNsfw || isGraphicNudity) return;

  // Find all subscribers
  const subscriptions = await prisma.postSubscription.findMany({
    where: { subscribedToId: authorId },
    select: { subscriberId: true },
  });

  if (subscriptions.length === 0) return;

  let subscriberIds = subscriptions.map((s) => s.subscriberId);

  // For close-friends-only posts, filter to only subscribers on the author's close friends list
  if (isCloseFriendsOnly) {
    const closeFriends = await prisma.closeFriend.findMany({
      where: { userId: authorId },
      select: { friendId: true },
    });
    const closeFriendIds = new Set(closeFriends.map((cf) => cf.friendId));
    subscriberIds = subscriberIds.filter((id) => closeFriendIds.has(id));
  }

  if (subscriberIds.length === 0) return;

  // Send in-app notifications + push to all qualifying subscribers
  const notificationPromises = subscriberIds.map((subscriberId) =>
    createNotification({
      type: "NEW_POST",
      actorId: authorId,
      targetUserId: subscriberId,
      postId,
    })
  );

  await Promise.allSettled(notificationPromises);

  // Queue email notifications for subscribers with email preference enabled
  const subscribersWithEmail = await prisma.user.findMany({
    where: {
      id: { in: subscriberIds },
      emailOnSubscribedPost: true,
      email: { not: null },
    },
    select: { email: true },
  });

  // Get author display name for email
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { displayName: true, username: true, name: true },
  });

  const authorName =
    author?.displayName ?? author?.username ?? author?.name ?? "Someone";

  const emailPromises = subscribersWithEmail.map((subscriber) =>
    inngest.send({
      name: "email/new-post" as const,
      data: {
        toEmail: subscriber.email!,
        authorName,
        postId,
      },
    })
  );

  await Promise.allSettled(emailPromises);
}
