import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { inngest } from "@/lib/inngest";

interface NotifyCommentSubscribersParams {
  postId: string;
  commentId: string;
  commentAuthorId: string;
  commenterName: string;
}

/**
 * Notify all users subscribed to comments on a post.
 * Skips the comment author and the post author (who gets a separate COMMENT notification).
 * Emails are only sent to subscribers who have emailEnabled on the subscription
 * AND the global emailOnSubscribedComment preference enabled.
 */
export async function notifyCommentSubscribers(
  params: NotifyCommentSubscribersParams
) {
  const { postId, commentId, commentAuthorId, commenterName } = params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });

  const subscriptions = await prisma.commentSubscription.findMany({
    where: { postId },
    select: { userId: true, emailEnabled: true },
  });

  if (subscriptions.length === 0) return;

  // Exclude the comment author and post author (already notified separately)
  const filtered = subscriptions.filter(
    (s) => s.userId !== commentAuthorId && s.userId !== post?.authorId
  );

  if (filtered.length === 0) return;

  const subscriberIds = filtered.map((s) => s.userId);

  // Send in-app + push notifications
  const notificationPromises = subscriberIds.map((subscriberId) =>
    createNotification({
      type: "SUBSCRIBED_COMMENT",
      actorId: commentAuthorId,
      targetUserId: subscriberId,
      postId,
      commentId,
    })
  );

  await Promise.allSettled(notificationPromises);

  // Only email subscribers who have email enabled on this specific subscription
  const emailEnabledIds = filtered
    .filter((s) => s.emailEnabled)
    .map((s) => s.userId);

  if (emailEnabledIds.length === 0) return;

  // Also check the global user preference
  const subscribersWithEmail = await prisma.user.findMany({
    where: {
      id: { in: emailEnabledIds },
      emailOnSubscribedComment: true,
      email: { not: null },
    },
    select: { email: true },
  });

  const emailPromises = subscribersWithEmail.map((subscriber) =>
    inngest.send({
      name: "email/subscribed-comment" as const,
      data: {
        toEmail: subscriber.email!,
        commenterName,
        postId,
      },
    })
  );

  await Promise.allSettled(emailPromises);
}
