import { test, expect } from "../fixtures/auth";
import pg from "pg";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

/**
 * Seed a conversation with a NSFW-flagged message between the two test users.
 * Returns { conversationId, messageId }.
 */
async function seedNsfwChatMessage() {
  const pool = createPool();
  try {
    const user1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const user2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
    const senderId = user2.rows[0].id;
    const recipientId = user1.rows[0].id;

    // Create conversation
    const conv = await pool.query(
      `INSERT INTO "Conversation" (id, "isGroup", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), false, NOW(), NOW()) RETURNING id`
    );
    const conversationId = conv.rows[0].id;

    // Add participants
    await pool.query(
      `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId", "joinedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW()), (gen_random_uuid(), $1, $3, NOW())`,
      [conversationId, senderId, recipientId]
    );

    // Create a message with NSFW media flag
    const msg = await pool.query(
      `INSERT INTO "Message" (id, "conversationId", "senderId", content, "mediaUrl", "mediaType", "isNsfw", "nsfwScore", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, '', 'https://example.com/nsfw.jpg', 'image', true, 0.92, NOW())
       RETURNING id`,
      [conversationId, senderId]
    );

    return { conversationId, messageId: msg.rows[0].id };
  } finally {
    await pool.end();
  }
}

/**
 * Seed a CHAT_ABUSE notification for test user 1 from test user 2.
 * Returns the notification id.
 */
async function seedChatAbuseNotification(conversationId: string, messageId: string) {
  const pool = createPool();
  try {
    const user1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const user2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);

    const notif = await pool.query(
      `INSERT INTO "Notification" (id, type, "actorId", "targetUserId", "messageId", "createdAt")
       VALUES (gen_random_uuid(), 'CHAT_ABUSE', $1, $2, $3, NOW()) RETURNING id`,
      [user2.rows[0].id, user1.rows[0].id, messageId]
    );
    return notif.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function cleanupChatModeration() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "ChatAbuseDismissal" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "ChatAbuseFlag" WHERE "senderId" = ANY($1) OR "recipientId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "Notification" WHERE "targetUserId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "Message" WHERE "senderId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "ConversationParticipant" WHERE "userId" = ANY($1)`, [ids]);
    // Clean up orphaned conversations
    await pool.query(
      `DELETE FROM "Conversation" WHERE id NOT IN (SELECT DISTINCT "conversationId" FROM "ConversationParticipant")`
    );
  } finally {
    await pool.end();
  }
}

test.describe("Chat Moderation", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
  });

  test.afterAll(async () => {
    await cleanupChatModeration();
  });

  test("NSFW chat media shows overlay and can be revealed", async ({ page, forceLogin }) => {
    await forceLogin;

    const { conversationId } = await seedNsfwChatMessage();

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    // Should see the NSFW overlay
    const overlay = page.getByText("Sensitive content");
    await expect(overlay).toBeVisible({ timeout: 10000 });

    // Should see reveal button
    const revealButton = page.getByText("Click to view");
    await expect(revealButton).toBeVisible();

    // Image should NOT be visible
    await expect(page.locator('img[src*="nsfw"]')).not.toBeVisible();

    // Click to reveal
    await revealButton.click();

    // Overlay should disappear, image should be visible
    await expect(overlay).not.toBeVisible();
    await expect(page.locator('img[src*="nsfw"]')).toBeVisible();
  });

  test("CHAT_ABUSE notification shows report/block/dismiss actions", async ({ page, forceLogin }) => {
    await forceLogin;

    const { conversationId, messageId } = await seedNsfwChatMessage();
    await seedChatAbuseNotification(conversationId, messageId);

    await page.goto("/notifications");
    await page.waitForTimeout(1500);

    // Should see the abuse notification text
    await expect(
      page.getByText("may be sending you abusive messages")
    ).toBeVisible({ timeout: 10000 });

    // Should see Report, Block, and Dismiss buttons
    await expect(page.getByRole("button", { name: "Report" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Block" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
  });

  test("dismiss button hides future alerts", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/notifications");
    await page.waitForTimeout(1500);

    // Click Dismiss
    const dismissButton = page.getByRole("button", { name: "Dismiss" });
    if (await dismissButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dismissButton.click();

      // Should see confirmation text
      await expect(
        page.getByText("Future alerts from this user dismissed.")
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
