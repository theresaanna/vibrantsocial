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
    select: { userId: true },
  });

  if (subscriptions.length === 0) return;

  // Exclude the comment author and post author (already notified separately)
  const subscriberIds = subscriptions
    .map((s) => s.userId)
    .filter((id) => id !== commentAuthorId && id !== post?.authorId);

  if (subscriberIds.length === 0) return;

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

  // Queue email notifications for subscribers with the preference enabled
  const subscribersWithEmail = await prisma.user.findMany({
    where: {
      id: { in: subscriberIds },
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
