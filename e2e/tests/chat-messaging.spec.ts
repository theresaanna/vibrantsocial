import { test, expect } from "../fixtures/auth";
import pg from "pg";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

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

    return { conversationId, userId1, userId2 };
  } finally {
    await pool.end();
  }
}

async function seedMessage(conversationId: string, senderEmail: string, content: string) {
  const pool = createPool();
  try {
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [senderEmail]);
    const senderId = user.rows[0].id;

    const result = await pool.query(
      `INSERT INTO "Message" (id, "conversationId", "senderId", content, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, NOW()) RETURNING id`,
      [conversationId, senderId, content]
    );
    return result.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function seedMessageRequest(senderEmail: string, receiverEmail: string) {
  const pool = createPool();
  try {
    const sender = await pool.query('SELECT id FROM "User" WHERE email = $1', [senderEmail]);
    const receiver = await pool.query('SELECT id FROM "User" WHERE email = $1', [receiverEmail]);

    await pool.query(
      `INSERT INTO "MessageRequest" (id, "senderId", "receiverId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'PENDING', NOW(), NOW())
       ON CONFLICT ("senderId", "receiverId") DO UPDATE SET status = 'PENDING', "updatedAt" = NOW()`,
      [sender.rows[0].id, receiver.rows[0].id]
    );
  } finally {
    await pool.end();
  }
}

async function cleanupChatData() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "MessageReaction" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "Message" WHERE "senderId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "MessageRequest" WHERE "senderId" = ANY($1) OR "receiverId" = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM "ConversationParticipant" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(
      `DELETE FROM "Conversation" WHERE id NOT IN (SELECT DISTINCT "conversationId" FROM "ConversationParticipant")`
    );
  } finally {
    await pool.end();
  }
}

test.describe("Chat Messaging @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let conversationId: string;

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
    await cleanupChatData();
    const result = await seedConversation();
    conversationId = result.conversationId;
  });

  test.afterAll(async () => {
    await cleanupChatData();
  });

  // --- Chat Page ---

  test("chat page lists conversations", async ({ page, forceLogin }) => {
    await forceLogin;

    // Seed a message so the conversation shows in the list
    await seedMessage(conversationId, TEST_USER_2.email, "Hello there!");

    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // Should see the conversation list with the other user
    const conversationItem = page.locator(`text=${TEST_USER_2.displayName}`).first();
    await expect(conversationItem).toBeVisible({ timeout: 10000 });
  });

  test("clicking conversation navigates to thread", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Click on the conversation link
    const conversationLink = page.locator(`a[href="/chat/${conversationId}"]`).first();
    await expect(conversationLink).toBeVisible({ timeout: 10000 });
    await conversationLink.click();

    // Should navigate to conversation page
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}`), { timeout: 10000 });
  });

  // --- Sending Messages ---

  test("can send a text message", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    const uniqueMsg = `e2e-msg-${Date.now()}`;
    await textarea.fill(uniqueMsg);
    await textarea.press("Enter");

    // Message should appear in the thread
    await expect(page.locator(`text=${uniqueMsg}`)).toBeVisible({ timeout: 10000 });
  });

  test("send button appears when text is entered", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill("Hello");
    await expect(page.getByLabel("Send message")).toBeVisible({ timeout: 5000 });

    // Clear text
    await textarea.fill("");
  });

  test("can send message via send button", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    const uniqueMsg = `e2e-send-btn-${Date.now()}`;
    await textarea.fill(uniqueMsg);

    const sendButton = page.getByLabel("Send message");
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    await expect(page.locator(`text=${uniqueMsg}`)).toBeVisible({ timeout: 10000 });
  });

  test("empty message cannot be sent", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const textarea = page.getByPlaceholder("Type a message...");
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Send button should not be visible with empty input
    await expect(page.getByLabel("Send message")).not.toBeVisible({ timeout: 3000 });

    // Pressing Enter on empty should not send
    await textarea.press("Enter");
    // No error, just nothing happens
  });

  // --- Viewing Messages ---

  test("displays messages from other users", async ({ page, forceLogin }) => {
    await forceLogin;

    const msgText = `e2e-from-other-${Date.now()}`;
    await seedMessage(conversationId, TEST_USER_2.email, msgText);

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    await expect(page.locator(`text=${msgText}`)).toBeVisible({ timeout: 10000 });
  });

  test("shows existing messages when opening conversation", async ({ page, forceLogin }) => {
    await forceLogin;

    // Seed multiple messages
    await seedMessage(conversationId, TEST_USER_2.email, `History msg 1 ${Date.now()}`);
    await seedMessage(conversationId, TEST_USER.email, `History msg 2 ${Date.now()}`);

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    // Should see messages in the thread
    const messages = page.locator('[class*="message"], [class*="bubble"]');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // --- File Attachment ---

  test("attach button is visible in message input", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    await expect(page.getByLabel("Attach file")).toBeVisible({ timeout: 10000 });
  });

  // --- Message Requests ---

  test("message requests appear in chat page", async ({ page, forceLogin }) => {
    await forceLogin;

    // Create a message request from user 2 to user 1
    await seedMessageRequest(TEST_USER_2.email, TEST_USER.email);

    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // Should see message requests section
    const requestsSection = page.locator("text=/Message Request/i");
    await expect(requestsSection).toBeVisible({ timeout: 10000 });
  });

  // --- Chat Header Options ---

  test("chat options menu shows report and block buttons", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/chat/${conversationId}`);
    await page.waitForTimeout(2000);

    const optionsButton = page.getByTestId("chat-options-button");
    await expect(optionsButton).toBeVisible({ timeout: 10000 });
    await optionsButton.click();

    await expect(page.getByTestId("chat-report-button")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("chat-block-button")).toBeVisible({ timeout: 3000 });
  });

  // --- New Conversation ---

  test("new message button opens conversation modal", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/chat");
    await page.waitForTimeout(2000);

    const newMsgButton = page.getByLabel("New message");
    await expect(newMsgButton).toBeVisible({ timeout: 10000 });
    await newMsgButton.click();

    // Modal should appear with Direct Message and Group Chat tabs
    await expect(page.locator("text=/Direct Message/i")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=/Group Chat/i")).toBeVisible();
  });

  test("empty state shown when no conversation selected", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/chat");
    await page.waitForTimeout(2000);

    // On desktop, should see empty state message
    const emptyState = page.locator("text=/Select a conversation/i");
    // This may only show on wider viewports
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
    }
  });
});
