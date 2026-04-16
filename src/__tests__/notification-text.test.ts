import { describe, it, expect } from "vitest";

vi.mock("@/generated/prisma/client", () => ({}));

import { vi } from "vitest";
import { getNotificationText } from "@/lib/notification-text";

// All known notification types and their expected text
const NOTIFICATION_CASES: [string, string][] = [
  ["LIKE", "liked your post"],
  ["COMMENT", "commented on your post"],
  ["REPLY", "replied to your comment"],
  ["REPOST", "reposted your post"],
  ["BOOKMARK", "bookmarked your post"],
  ["FOLLOW", "followed you"],
  ["REACTION", "reacted to your message"],
  ["MENTION", "mentioned you"],
  ["FRIEND_REQUEST", "sent you a friend request"],
  ["FRIEND_REQUEST_ACCEPTED", "accepted your friend request"],
  ["NEW_POST", "published a new post"],
  ["TAG_POST", "posted in a tag you follow"],
  ["CONTENT_MODERATION", "Please be sure to mark your posts NSFW or Explicit/Graphic if needed. We have put a content warning on one of your posts. Please help us keep our community safe for all. Thank you"],
  ["REFERRAL_SIGNUP", "joined using your referral link! You earned 50 stars."],
  ["STARS_MILESTONE", "You have 500+ stars! Redeem them for a free month of premium."],
  ["LIST_ADD", "added you to a list"],
  ["LIST_SUBSCRIBE", "subscribed to your list"],
  ["LIST_COLLABORATOR_ADD", "added you as a collaborator on a list"],
  ["WALL_POST", "posted on your wall"],
  ["MARKETPLACE_QUESTION", "asked a question on your listing"],
  ["MARKETPLACE_ANSWER", "answered your question on a listing"],
  ["CHAT_REQUEST", "sent you a chat request"],
  ["CHAT_REQUEST_ACCEPTED", "accepted your chat request"],
  ["CHAT_ABUSE", "may be sending you abusive messages. You can report or block this user."],
  ["SUBSCRIBED_COMMENT", "commented on a post you're subscribed to"],
];

describe("getNotificationText", () => {
  it.each(NOTIFICATION_CASES)(
    'returns correct text for %s',
    (type, expected) => {
      expect(getNotificationText(type as any)).toBe(expected);
    }
  );

  it("returns empty string for unknown notification type", () => {
    expect(getNotificationText("UNKNOWN_TYPE" as any)).toBe("");
  });

  it("returns non-empty string for every known type", () => {
    for (const [type] of NOTIFICATION_CASES) {
      const text = getNotificationText(type as any);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  // Group tests by category for readability
  describe("social interaction types", () => {
    it("returns user-facing action text", () => {
      expect(getNotificationText("LIKE" as any)).toContain("liked");
      expect(getNotificationText("COMMENT" as any)).toContain("commented");
      expect(getNotificationText("FOLLOW" as any)).toContain("followed");
      expect(getNotificationText("REPOST" as any)).toContain("reposted");
    });
  });

  describe("system notification types", () => {
    it("returns descriptive text for moderation", () => {
      const text = getNotificationText("CONTENT_MODERATION" as any);
      expect(text).toContain("content warning");
    });

    it("returns descriptive text for referral signup", () => {
      const text = getNotificationText("REFERRAL_SIGNUP" as any);
      expect(text).toContain("referral");
      expect(text).toContain("stars");
    });

    it("returns descriptive text for stars milestone", () => {
      const text = getNotificationText("STARS_MILESTONE" as any);
      expect(text).toContain("500+");
      expect(text).toContain("premium");
    });
  });

  describe("chat types", () => {
    it("handles chat request and acceptance", () => {
      expect(getNotificationText("CHAT_REQUEST" as any)).toContain("chat request");
      expect(getNotificationText("CHAT_REQUEST_ACCEPTED" as any)).toContain("accepted");
    });

    it("handles chat abuse warning", () => {
      const text = getNotificationText("CHAT_ABUSE" as any);
      expect(text).toContain("abusive");
      expect(text).toContain("report");
      expect(text).toContain("block");
    });
  });

  describe("list types", () => {
    it("differentiates list notification types", () => {
      expect(getNotificationText("LIST_ADD" as any)).toContain("added you to a list");
      expect(getNotificationText("LIST_SUBSCRIBE" as any)).toContain("subscribed to your list");
      expect(getNotificationText("LIST_COLLABORATOR_ADD" as any)).toContain("collaborator");
    });
  });
});
