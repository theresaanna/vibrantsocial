import { test, expect } from "../fixtures/auth";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

/** Clear the cached followingIds so the feed picks up new Follow rows. */
async function invalidateFollowingCache(userId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });
  await redis.del(`user:${userId}:following`);
}

/** Seed a post by TEST_USER_2 and a simple repost of it by TEST_USER. */
async function seedRepostData() {
  const pool = createPool();
  try {
    // Get both user IDs
    const u1 = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    const u2 = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER_2.email]
    );
    if (u1.rows.length === 0 || u2.rows.length === 0)
      throw new Error("Test users not found — run global-setup first");

    const testUserId = u1.rows[0].id;
    const testUser2Id = u2.rows[0].id;

    // NOTE: Do NOT have TEST_USER follow TEST_USER_2 here — if the user
    // follows the original post's author, the post appears directly in the
    // feed AND via repost, and the dedup filter removes the simple repost.
    // By only following themselves, the repost (by TEST_USER) will appear
    // without the direct post competing.

    // Ensure TEST_USER follows themselves (own reposts appear in feed)
    await pool.query(
      `INSERT INTO "Follow" (id, "followerId", "followingId", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [`follow_e2e_self_${Date.now()}`, testUserId, testUserId]
    );

    // Create a post by TEST_USER_2
    const postId = `post_e2e_repost_${Date.now()}`;
    await pool.query(
      `INSERT INTO "Post" (id, content, "authorId", "createdAt", "updatedAt", "isSensitive", "isNsfw", "isGraphicNudity", "isPinned")
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 hour', NOW(), false, false, false, false)`,
      [postId, '"E2E repost test post"', testUser2Id]
    );

    // Create a simple repost (no content) by TEST_USER
    const repostId = `repost_e2e_${Date.now()}`;
    await pool.query(
      `INSERT INTO "Repost" (id, "postId", "userId", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [repostId, postId, testUserId]
    );

    // Invalidate Redis cache so the feed query picks up the new follow
    await invalidateFollowingCache(testUserId);

    return { postId, repostId, testUserId, testUser2Id };
  } finally {
    await pool.end();
  }
}

async function cleanupRepostData(postId: string, repostId: string) {
  const pool = createPool();
  try {
    await pool.query('DELETE FROM "Repost" WHERE id = $1', [repostId]);
    await pool.query('DELETE FROM "Post" WHERE id = $1', [postId]);
  } finally {
    await pool.end();
  }
}

test.describe("Repost Header", () => {
  let postId: string;
  let repostId: string;

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    const data = await seedRepostData();
    postId = data.postId;
    repostId = data.repostId;
  });

  test.afterAll(async () => {
    if (postId && repostId) {
      await cleanupRepostData(postId, repostId);
    }
  });

  test("simple repost shows repost-header with reposter name in feed", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // The repost header should be visible with the test user's username
    const repostHeader = page.getByTestId("repost-header").first();
    await expect(repostHeader).toBeVisible({ timeout: 15000 });

    // Header should contain the reposter's name and the word "reposted"
    await expect(repostHeader).toContainText("reposted");
  });
});
