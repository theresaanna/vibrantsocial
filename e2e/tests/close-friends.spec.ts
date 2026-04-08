import { test, expect } from "../fixtures/auth";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupCloseFriends() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "CloseFriend" WHERE "userId" = ANY($1)`, [ids]);

    // Clean up close-friends-only test posts
    await pool.query(
      `DELETE FROM "Post" WHERE "authorId" = ANY($1) AND "isCloseFriendsOnly" = true`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

async function invalidateCloseFriendCache(userId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });
  await redis.del(`userCloseFriendIds:${userId}`);
  await redis.del(`userCloseFriendOf:${userId}`);
}

test.describe("Close Friends @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
    await cleanupCloseFriends();
  });

  test.afterAll(async () => {
    await cleanupCloseFriends();
  });

  // --- Close Friends Management Page ---

  test("close friends page is accessible", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/close-friends");
    await expect(page).toHaveURL(/\/close-friends/);

    // Should see the page content
    await expect(page.locator("text=/close friends/i").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows available friends to add", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/close-friends");
    await page.waitForTimeout(2000);

    // Should see test user 2 in the available friends section
    await expect(page.getByText(TEST_USER_2.username)).toBeVisible({ timeout: 10000 });

    // Should see an Add button
    await expect(page.locator('button:has-text("Add")').first()).toBeVisible();
  });

  test("can add a close friend", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/close-friends");
    await page.waitForTimeout(2000);

    // Find the Add button next to test user 2
    const addButton = page.locator('button:has-text("Add")').first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // After adding, should see a Remove button instead
    await page.waitForTimeout(1000);
    await expect(page.locator('button:has-text("Remove")').first()).toBeVisible({ timeout: 10000 });
  });

  test("can remove a close friend", async ({ page, forceLogin }) => {
    await forceLogin;

    // Ensure user 2 is a close friend (from previous test or seed)
    const pool = createPool();
    try {
      const u1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
      const u2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
      await pool.query(
        `INSERT INTO "CloseFriend" (id, "userId", "friendId", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [u1.rows[0].id, u2.rows[0].id]
      );
      await invalidateCloseFriendCache(u1.rows[0].id);
    } finally {
      await pool.end();
    }

    await page.goto("/close-friends");
    await page.waitForTimeout(2000);

    const removeButton = page.locator('button:has-text("Remove")').first();
    await expect(removeButton).toBeVisible({ timeout: 10000 });
    await removeButton.click();

    // After removal, should see Add button again
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('button:has-text("Add")').first()).toBeVisible({ timeout: 10000 });
  });

  // --- Close Friends Feed Tab ---

  test("close friends tab is visible in feed", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForTimeout(2000);

    const closeFriendsTab = page.getByRole("link", { name: "Close Friends" });
    await expect(closeFriendsTab).toBeVisible({ timeout: 10000 });
  });

  test("clicking close friends tab navigates to close friends feed", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForTimeout(2000);

    await page.click('a[href="/feed?list=close-friends"]');
    await expect(page).toHaveURL(/list=close-friends/, { timeout: 10000 });
  });

  // --- Close Friends Post Creation ---

  test("compose page shows close friends toggle", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/compose");

    // Dismiss hint if present
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Close Friends toggle should be visible
    const closeFriendsLabel = page.locator("text=Close Friends").last();
    await expect(closeFriendsLabel).toBeVisible({ timeout: 10000 });
  });

  test("close friends toggle activates with green styling", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/compose");

    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Click the Close Friends label/toggle
    const closeFriendsToggle = page.locator("label").filter({ hasText: "Close Friends" });
    await expect(closeFriendsToggle).toBeVisible({ timeout: 10000 });
    await closeFriendsToggle.click();

    // Should show green active styling
    await expect(closeFriendsToggle).toHaveClass(/bg-green/, { timeout: 5000 });
  });

  test("can create a close-friends-only post", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/compose");

    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();

    const postText = `e2e-close-friends-post-${Date.now()}`;
    await editor.pressSequentially(postText, { delay: 10 });

    // Enable close friends toggle
    const closeFriendsToggle = page.locator("label").filter({ hasText: "Close Friends" });
    await closeFriendsToggle.click();

    // Submit the post
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Post should appear in feed with close friends indicator
    const postContent = page.locator(`text=${postText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Should show the close friends badge (green star icon)
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    const closeFriendsBadge = postCard.locator('[title="Close friends only"]');
    await expect(closeFriendsBadge).toBeVisible({ timeout: 5000 });
  });
});
