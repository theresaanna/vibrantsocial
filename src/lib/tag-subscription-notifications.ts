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
}

/**
 * Notify users subscribed to any of the post's tags.
 * Skips sensitive/graphic and close-friends-only posts.
 * NSFW posts only notify subscribers who opted into NSFW content.
 * Deduplicates across tags so each user gets at most one notification.
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
  } = params;

  // Don't notify for sensitive/graphic or close-friends-only content
  if (isSensitive || isGraphicNudity || isCloseFriendsOnly) return;
  if (tagIds.length === 0) return;

  // Find all subscriptions for these tags
  const subscriptions = await prisma.tagSubscription.findMany({
    where: { tagId: { in: tagIds } },
    select: { userId: true, tagId: true, frequency: true },
  });

  if (subscriptions.length === 0) return;

  // Deduplicate by userId — keep the first subscription's tagId for the notification
  const seen = new Map<string, { tagId: string; frequency: string }>();
  for (const sub of subscriptions) {
    if (sub.userId === authorId) continue; // Don't notify the author
    if (!seen.has(sub.userId)) {
      seen.set(sub.userId, { tagId: sub.tagId, frequency: sub.frequency });
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

  // Split into immediate and digest subscribers
  const immediateIds = subscriberIds.filter(
    (id) => seen.get(id)!.frequency === "immediate"
  );
  const _digestIds = subscriberIds.filter(
    (id) => seen.get(id)!.frequency === "digest"
  );
  // Digest subscribers are handled by the daily cron job, not here.

  // Send in-app notifications to immediate subscribers
  if (immediateIds.length > 0) {
    const notificationPromises = immediateIds.map((subscriberId) =>
      createNotification({
        type: "TAG_POST",
        actorId: authorId,
        targetUserId: subscriberId,
        postId,
        tagId: seen.get(subscriberId)!.tagId,
      })
    );

    await Promise.allSettled(notificationPromises);

    // Queue email notifications for immediate subscribers with email preference enabled
    const subscribersWithEmail = await prisma.user.findMany({
      where: {
        id: { in: immediateIds },
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
