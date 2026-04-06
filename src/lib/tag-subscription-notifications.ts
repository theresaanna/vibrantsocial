import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";

interface NotifyTagSubscribersParams {
  authorId: string;
  postId: string;
  tagIds: string[];
  tagNames: string[];
  isSensitive?: boolean;
  isNsfw?: boolean;
  isGraphicNudity?: boolean;
  isCloseFriendsOnly?: boolean;
  hasCustomAudience?: boolean;
  customAudienceIds?: string[];
}

/**
 * Notify users subscribed to any of the post's tags.
 * Skips sensitive/graphic and close-friends-only posts.
 * NSFW posts only notify subscribers who opted into NSFW content.
 * Deduplicates across tags so each user gets at most one notification.
 *
 * In-app notifications are sent to ALL subscribers.
 * Email notifications are only sent to subscribers with emailNotification enabled.
 */
export async function notifyTagSubscribers(params: NotifyTagSubscribersParams) {
  const {
    authorId,
    postId,
    tagIds,
    tagNames,
    isSensitive = false,
    isNsfw = false,
    isGraphicNudity = false,
    isCloseFriendsOnly = false,
    hasCustomAudience = false,
  } = params;

  // Don't notify for sensitive/graphic, close-friends-only, or custom-audience content
  // (tag subscribers are random users who can't see restricted posts)
  if (isSensitive || isGraphicNudity || isCloseFriendsOnly || hasCustomAudience) return;
  if (tagIds.length === 0) return;

  // Find all subscriptions for these tags
  const subscriptions = await prisma.tagSubscription.findMany({
    where: { tagId: { in: tagIds } },
    select: { userId: true, tagId: true, frequency: true, emailNotification: true },
  });

  if (subscriptions.length === 0) return;

  // Deduplicate by userId — keep the first subscription's tagId for the notification
  const seen = new Map<string, { tagId: string; frequency: string; emailNotification: boolean }>();
  for (const sub of subscriptions) {
    if (sub.userId === authorId) continue; // Don't notify the author
    if (!seen.has(sub.userId)) {
      seen.set(sub.userId, {
        tagId: sub.tagId,
        frequency: sub.frequency,
        emailNotification: sub.emailNotification,
      });
    }
  }

  if (seen.size === 0) return;

  let subscriberIds = Array.from(seen.keys());

  // For NSFW posts, only notify subscribers who opted into NSFW content
  if (isNsfw) {
    const nsfwOptedIn = await prisma.user.findMany({
      where: {
        id: { in: subscriberIds },
        showNsfwContent: true,
      },
      select: { id: true },
    });
    const nsfwIds = new Set(nsfwOptedIn.map((u) => u.id));
    subscriberIds = subscriberIds.filter((id) => nsfwIds.has(id));
  }

  if (subscriberIds.length === 0) return;

  // Send in-app notifications to ALL subscribers (regardless of frequency)
  const notificationPromises = subscriberIds.map((subscriberId) =>
    createNotification({
      type: "TAG_POST",
      actorId: authorId,
      targetUserId: subscriberId,
      postId,
      tagId: seen.get(subscriberId)!.tagId,
    })
  );

  await Promise.allSettled(notificationPromises);

  // Queue email notifications only for subscribers with emailNotification enabled
  // and frequency === "immediate" (digest subscribers are handled by cron)
  const immediateEmailIds = subscriberIds.filter((id) => {
    const sub = seen.get(id)!;
    return sub.emailNotification && sub.frequency === "immediate";
  });

  if (immediateEmailIds.length > 0) {
    const subscribersWithEmail = await prisma.user.findMany({
      where: {
        id: { in: immediateEmailIds },
        emailOnTagPost: true,
        email: { not: null },
      },
      select: { email: true },
    });

    if (subscribersWithEmail.length > 0) {
      // Get author display name for email
      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { displayName: true, username: true, name: true },
      });

      const authorName =
        author?.displayName ?? author?.username ?? author?.name ?? "Someone";

      const emailPromises = subscribersWithEmail.map((subscriber) =>
        inngest.send({
          name: "email/tag-post" as const,
          data: {
            toEmail: subscriber.email!,
            authorName,
            postId,
            tagNames,
          },
        })
      );

      await Promise.allSettled(emailPromises);
    }
  }
}
