import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_USER_2 } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function getUserIds(pool: pg.Pool) {
  const result = await pool.query(
    `SELECT id, email FROM "User" WHERE email IN ($1, $2)`,
    [TEST_USER.email, TEST_USER_2.email]
  );
  const user1 = result.rows.find(
    (r: { email: string }) => r.email === TEST_USER.email
  );
  const user2 = result.rows.find(
    (r: { email: string }) => r.email === TEST_USER_2.email
  );
  return { user1Id: user1?.id as string, user2Id: user2?.id as string };
}

async function createBlock(
  pool: pg.Pool,
  blockerId: string,
  blockedId: string
) {
  await pool.query(
    `INSERT INTO "Block" (id, "blockerId", "blockedId", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
}

async function createFollow(
  pool: pg.Pool,
  followerEmail: string,
  followingEmail: string
) {
  const follower = await pool.query(
    `SELECT id FROM "User" WHERE email = $1`,
    [followerEmail]
  );
  const following = await pool.query(
    `SELECT id FROM "User" WHERE email = $1`,
    [followingEmail]
  );
  if (!follower.rows[0] || !following.rows[0]) return;

  await pool.query(
    `INSERT INTO "Follow" (id, "followerId", "followingId", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [follower.rows[0].id, following.rows[0].id]
  );
}

async function cleanupBlocks(pool: pg.Pool, userId: string) {
  await pool.query(
    `DELETE FROM "Block" WHERE "blockerId" = $1 OR "blockedId" = $1`,
    [userId]
  );
}

async function cleanupRelationships(pool: pg.Pool, ids: string[]) {
  await pool.query(
    `DELETE FROM "Block" WHERE "blockerId" = ANY($1) OR "blockedId" = ANY($1)`,
    [ids]
  );
  await pool.query(
    `DELETE FROM "Follow" WHERE "followerId" = ANY($1) AND "followingId" = ANY($1)`,
    [ids]
  );
  await pool.query(
    `DELETE FROM "FriendRequest" WHERE "senderId" = ANY($1) AND "receiverId" = ANY($1)`,
    [ids]
  );
}

test.describe("Block User", () => {
  let pool: pg.Pool;
  let user1Id: string;
  let user2Id: string;

  test.beforeAll(async () => {
    pool = createPool();
    const ids = await getUserIds(pool);
    user1Id = ids.user1Id;
    user2Id = ids.user2Id;
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test.beforeEach(async () => {
    await cleanupRelationships(pool, [user1Id, user2Id]);
  });

  test.afterEach(async () => {
    await cleanupRelationships(pool, [user1Id, user2Id]);
  });

  test("block button is visible on other user's profile", async ({ page }) => {
    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
  });

  test("block button is NOT visible on own profile", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).not.toBeVisible();
  });

  test("clicking block shows confirmation dialog", async ({ page }) => {
    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should show "Block?" title
    await expect(dialog.locator("h3", { hasText: "Block?" })).toBeVisible();

    // Dialog should mention removing follows/friends
    await expect(
      dialog.locator("text=Existing follows and friend connections will be removed")
    ).toBeVisible();

    // Should have Block and Cancel buttons
    await expect(
      dialog.getByRole("button", { name: "Block" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("cancel dismisses block dialog", async ({ page }) => {
    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Dialog should be dismissed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Block button should still be visible (not blocked state)
    await expect(blockButton).toBeVisible({ timeout: 5000 });
  });

  test("after blocking, profile shows 'blocked' message", async ({
    page,
  }) => {
    // Seed a Block record: TEST_USER blocks TEST_USER_2
    await createBlock(pool, user1Id, user2Id);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show "You have blocked this user" message
    await expect(
      page.locator("text=You have blocked this user")
    ).toBeVisible({ timeout: 5000 });
  });

  test("blocked user sees 'unavailable' message", async ({ browser }) => {
    // Seed a Block: TEST_USER_2 blocks TEST_USER
    await createBlock(pool, user2Id, user1Id);

    // Log in as TEST_USER (already authenticated via storageState),
    // visit TEST_USER_2's profile
    const context = await browser.newContext({
      storageState: "e2e/auth/user.json",
    });
    const page = await context.newPage();

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show "This content is unavailable" message
    await expect(
      page.locator("text=This content is unavailable")
    ).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("block removes follow relationship", async ({ page }) => {
    // Seed a follow: TEST_USER follows TEST_USER_2
    await createFollow(pool, TEST_USER.email, TEST_USER_2.email);

    // Seed a Block: TEST_USER blocks TEST_USER_2
    await createBlock(pool, user1Id, user2Id);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show blocked message instead of "Following" button
    await expect(
      page.locator("text=You have blocked this user")
    ).toBeVisible({ timeout: 5000 });

    // "Following" button should NOT be visible
    await expect(
      page.getByRole("button", { name: "Following" })
    ).not.toBeVisible();
  });

  test("unblock restores profile access", async ({ page }) => {
    // Seed a Block: TEST_USER blocks TEST_USER_2
    await createBlock(pool, user1Id, user2Id);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show blocked message
    await expect(
      page.locator("text=You have blocked this user")
    ).toBeVisible({ timeout: 5000 });

    // Click the unblock button (same block button, now in "blocked" state)
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    // Confirmation dialog should appear with "Unblock?" title
    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(
      dialog.locator("h3", { hasText: "Unblock?" })
    ).toBeVisible();

    // Click Unblock to confirm
    await dialog.getByRole("button", { name: "Unblock" }).click();

    // Wait for the page to update — blocked message should disappear
    await expect(
      page.locator("text=You have blocked this user")
    ).not.toBeVisible({ timeout: 10000 });

    // Profile content should reappear (stats like "posts", "followers" visible)
    await expect(page.locator("text=posts")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=followers")).toBeVisible({ timeout: 5000 });
  });
});
