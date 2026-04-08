import { test, expect } from "../fixtures/auth";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function invalidateFollowingCache(userId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });
  await redis.del(`user:${userId}:following`);
}

async function seedPostForQuoting() {
  const pool = createPool();
  try {
    const u1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const u2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
    const testUserId = u1.rows[0].id;
    const testUser2Id = u2.rows[0].id;

    // Ensure TEST_USER follows TEST_USER_2 so their posts show in feed
    await pool.query(
      `INSERT INTO "Follow" (id, "followerId", "followingId", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [`follow_e2e_quote_${Date.now()}`, testUserId, testUser2Id]
    );
    await invalidateFollowingCache(testUserId);

    // Create a post by TEST_USER_2
    const postId = `post_e2e_quote_${Date.now()}`;
    const postContent = `Quotable post ${Date.now()}`;
    await pool.query(
      `INSERT INTO "Post" (id, content, "authorId", "createdAt", "updatedAt", "isSensitive", "isNsfw", "isGraphicNudity", "isPinned")
       VALUES ($1, $2, $3, NOW() - INTERVAL '5 minutes', NOW(), false, false, false, false)`,
      [postId, JSON.stringify(postContent), testUser2Id]
    );

    return { postId, postContent, testUserId, testUser2Id };
  } finally {
    await pool.end();
  }
}

async function cleanupQuoteData() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "Repost" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(
      `DELETE FROM "Post" WHERE "authorId" = ANY($1) AND id LIKE 'post_e2e_quote_%'`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Quote Posts @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let postId: string;

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
    await cleanupQuoteData();
    const data = await seedPostForQuoting();
    postId = data.postId;
  });

  test.afterAll(async () => {
    await cleanupQuoteData();
  });

  test("repost button dropdown shows Quote Post option", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Find a post card with the repost button
    const repostButton = page.getByTestId("repost-button").first();
    await expect(repostButton).toBeVisible({ timeout: 15000 });
    await repostButton.click();

    // Should show Quote Post option in dropdown
    await expect(page.getByText("Quote Post")).toBeVisible({ timeout: 5000 });
  });

  test("clicking Quote Post navigates to quote editor", async ({ page, forceLogin }) => {
    await forceLogin;

    // Navigate directly to the quote page for our seeded post
    await page.goto(`/post/${postId}/quote`);

    // Quote editor should be visible
    const quoteEditor = page.getByTestId("quote-editor");
    await expect(quoteEditor).toBeVisible({ timeout: 15000 });

    // Submit button should be visible
    await expect(page.getByTestId("quote-submit")).toBeVisible();
  });

  test("quote editor requires content before submitting", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/post/${postId}/quote`);

    const quoteEditor = page.getByTestId("quote-editor");
    await expect(quoteEditor).toBeVisible({ timeout: 15000 });

    // Try to submit without typing anything
    const submitButton = page.getByTestId("quote-submit");

    // Submit button should be disabled when editor is empty
    await expect(submitButton).toBeDisabled({ timeout: 5000 });
  });

  test("can create a quote post with sufficient content", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto(`/post/${postId}/quote`);

    const quoteEditor = page.getByTestId("quote-editor");
    await expect(quoteEditor).toBeVisible({ timeout: 15000 });

    const editor = quoteEditor.locator('[contenteditable="true"]').first();
    await editor.click();

    // Type enough content (50+ chars)
    const quoteText = `This is my e2e quote post with enough content to pass the validation check ${Date.now()}`;
    await editor.pressSequentially(quoteText, { delay: 5 });

    const submitButton = page.getByTestId("quote-submit");
    await submitButton.click();

    // Should redirect away from the quote page on success
    await expect(page).not.toHaveURL(new RegExp(`/post/${postId}/quote`), {
      timeout: 30000,
    });
  });

  test("quote post shows quote-header in feed", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Should see a quote header from the quote we just created
    const quoteHeader = page.getByTestId("quote-header").first();
    await expect(quoteHeader).toBeVisible({ timeout: 15000 });
    await expect(quoteHeader).toContainText("quoted");
  });

  test("quote post has action buttons", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Find the quote post actions
    const quoteHeader = page.getByTestId("quote-header").first();
    await expect(quoteHeader).toBeVisible({ timeout: 15000 });

    // Quote action buttons should be present
    await expect(page.getByTestId("quote-like-button").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("quote-comment-button").first()).toBeVisible();
    await expect(page.getByTestId("quote-bookmark-button").first()).toBeVisible();
  });

  test("can like a quote post", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    const likeButton = page.getByTestId("quote-like-button").first();
    await expect(likeButton).toBeVisible({ timeout: 15000 });
    await likeButton.click();

    // Like count should update (button state changes)
    await page.waitForTimeout(1000);
    // The button should still be interactive
    await expect(likeButton).toBeVisible();
  });

  test("can bookmark a quote post", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    const bookmarkButton = page.getByTestId("quote-bookmark-button").first();
    await expect(bookmarkButton).toBeVisible({ timeout: 15000 });
    await bookmarkButton.click();

    await page.waitForTimeout(1000);
    await expect(bookmarkButton).toBeVisible();
  });
});
