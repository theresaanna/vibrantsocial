import type { NotificationType } from "@/generated/prisma/client";

export function getNotificationText(type: NotificationType): string {
  switch (type) {
    case "LIKE":
      return "liked your post";
    case "COMMENT":
      return "commented on your post";
    case "REPLY":
      return "replied to your comment";
    case "REPOST":
      return "reposted your post";
    case "BOOKMARK":
      return "bookmarked your post";
    case "FOLLOW":
      return "followed you";
    case "REACTION":
      return "reacted to your message";
    case "MENTION":
      return "mentioned you";
    case "FRIEND_REQUEST":
      return "sent you a friend request";
    case "FRIEND_REQUEST_ACCEPTED":
      return "accepted your friend request";
    case "NEW_POST":
      return "published a new post";
    case "TAG_POST":
      return "posted in a tag you follow";
    case "CONTENT_MODERATION":
      return "Your post was flagged for unmarked adult content. A strike has been recorded.";
    case "REFERRAL_SIGNUP":
      return "joined using your referral link! You earned 50 stars.";
    case "STARS_MILESTONE":
      return "You have 500+ stars! Redeem them for a free month of premium.";
    case "LIST_ADD":
      return "added you to a list";
    case "LIST_SUBSCRIBE":
      return "subscribed to your list";
    case "LIST_COLLABORATOR_ADD":
      return "added you as a collaborator on a list";
    case "WALL_POST":
      return "posted on your wall";
    case "MARKETPLACE_QUESTION":
      return "asked a question on your listing";
    case "MARKETPLACE_ANSWER":
      return "answered your question on a listing";
    case "CHAT_REQUEST":
      return "sent you a chat request";
    case "CHAT_REQUEST_ACCEPTED":
      return "accepted your chat request";
    case "CHAT_ABUSE":
      return "may be sending you abusive messages. You can report or block this user.";
    default:
      return "";
  }
}
