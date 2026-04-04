import { test, expect } from "../fixtures/auth";
import pg from "pg";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

/**
 * Seed a conversation between the two test users.
 * Returns { conversationId }.
 */
async function seedConversation() {
  const pool = createPool();
  try {
    const user1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const user2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
    const userId1 = user1.rows[0].id;
    const userId2 = user2.rows[0].id;

    const conv = await pool.query(
      `INSERT INTO "Conversation" (id, "isGroup", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), false, NOW(), NOW()) RETURNING id`
    );
    const conversationId = conv.rows[0].id;

    await pool.query(
      `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId", "joinedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW()), (gen_random_uuid(), $1, $3, NOW())`,
      [conversationId, userId1, userId2]
    );

    return { conversationId };
  } finally {
    await pool.end();
  }
}

/**
 * Seed a message containing a URL for link preview testing.
 */
async function seedMessageWithUrl(conversationId: string, url: string) {
  const pool = createPool();
  try {
    const user1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
    const senderId = user1.rows[0].id;

    await pool.query(
      `INSERT INTO "Message" (id, "conversationId", "senderId", content, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [conversationId, senderId, `Check out ${url}`]
    );
  } finally {
    await pool.end();
  }
}

async function cleanupConversations() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "Message" WHERE "senderId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "ConversationParticipant" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(
      `DELETE FROM "Conversation" WHERE id NOT IN (SELECT DISTINCT "conversationId" FROM "ConversationParticipant")`
    );
  } finally {
    await pool.end();
  }
}

test.describe("Chat Image Paste & Link Preview", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let conversationId: string;

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
    const result = await seedConversation();
    conversationId = result.conversationId;
  });

  test.afterAll(async () => {
    await cleanupConversations();
  });

  test("pasting an image into chat shows preview and can be sent", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.focus();

    // Create a small PNG buffer for paste simulation
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Paste image via clipboard API
    await page.evaluate(async (data) => {
      const blob = new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: "image/png" });
      const file = new File([blob], "pasted-image.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector("textarea")?.dispatchEvent(event);
    }, pngBuffer.toString("base64"));

    // Should see file preview
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible({ timeout: 5000 });

    // Send button should appear
    await expect(page.getByLabel("Send message")).toBeVisible();
  });

  test("message with URL shows link preview container", async ({ page, forceLogin }) => {
    await forceLogin;

    // Seed a message with URL
    await seedMessageWithUrl(conversationId, "https://example.com");

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    // Link preview container should be attached (may not be "visible" if the
    // remote URL returns no OG metadata, but the container is still rendered
    // while loading or when data is available).
    const preview = page.locator('[data-testid="chat-link-preview"]');
    await expect(preview).toBeAttached({ timeout: 15000 });
  });

  test("message content with URL renders linkified text", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    // The URL in the message text should be rendered as a clickable link
    const link = page.locator('a[href="https://example.com"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test("sending a message with URL shows link preview container", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill("Look at https://example.com/test");
    await textarea.press("Enter");

    // Wait for message to be sent and rendered
    await page.waitForTimeout(3000);

    // The sent message should have a link preview container
    const previews = page.locator('[data-testid="chat-link-preview"]');
    await expect(previews.last()).toBeAttached({ timeout: 15000 });
  });
});
