import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_USER_2, invalidateRelationshipCache } from "../helpers/db";
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
  await invalidateRelationshipCache(blockerId, blockedId);
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
  await invalidateRelationshipCache(follower.rows[0].id, following.rows[0].id);
}

async function cleanupBlocks(pool: pg.Pool, ids: string[]) {
  await pool.query(
    `DELETE FROM "Block" WHERE "blockerId" = ANY($1) OR "blockedId" = ANY($1)`,
    [ids]
  );
  if (ids.length >= 2) {
    await invalidateRelationshipCache(ids[0], ids[1]);
  }
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
  if (ids.length >= 2) {
    await invalidateRelationshipCache(ids[0], ids[1]);
  }
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
    // Retry to ensure fresh RSC render after cleanup
    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("h1", { hasText: TEST_USER_2.displayName })
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
  });

  test("block button is NOT visible on own profile", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}`);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).not.toBeVisible();
  });

  test("clicking block shows confirmation dialog", async ({ page }) => {
    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("h1", { hasText: TEST_USER_2.displayName })
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    const dialog = page.locator("dialog[open]");
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
    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("h1", { hasText: TEST_USER_2.displayName })
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    const dialog = page.locator("dialog[open]");
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

    // Retry navigation to ensure fresh RSC render picks up the block
    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=You have blocked this user")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });
  });

  test("blocked user sees 'unavailable' message", async ({ browser }) => {
    // Seed a Block: TEST_USER_2 blocks TEST_USER
    await createBlock(pool, user2Id, user1Id);

    const context = await browser.newContext({
      storageState: "e2e/auth/user.json",
    });
    const page = await context.newPage();

    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=This content is unavailable")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    await context.close();
  });

  test("block removes follow relationship", async ({ page }) => {
    // Seed a follow: TEST_USER follows TEST_USER_2
    await createFollow(pool, TEST_USER.email, TEST_USER_2.email);

    // Seed a Block: TEST_USER blocks TEST_USER_2
    await createBlock(pool, user1Id, user2Id);

    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=You have blocked this user")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    // "Following" button should NOT be visible
    await expect(
      page.getByRole("button", { name: "Following" })
    ).not.toBeVisible();
  });

  test("unblock restores profile access", async ({ page }) => {
    // Seed a Block: TEST_USER blocks TEST_USER_2
    await createBlock(pool, user1Id, user2Id);

    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=You have blocked this user")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    // Click the unblock button (same block button, now in "blocked" state)
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    // Confirmation dialog should appear with "Unblock?" title
    const dialog = page.locator("dialog[open]");
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

    // Profile content should reappear (stats like "0 posts", "0 followers" visible)
    await expect(page.getByText(/\d+ posts/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\d+ followers/)).toBeVisible({ timeout: 5000 });
  });

  test("blocked profile hides bio, stats, and action buttons", async ({
    page,
  }) => {
    await createBlock(pool, user1Id, user2Id);

    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=You have blocked this user")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    // Bio should NOT be visible
    const bio = page.locator('[class*="bio"]');
    await expect(bio).not.toBeVisible();

    // Follow/Friend/Subscribe buttons should NOT be visible
    await expect(
      page.getByRole("button", { name: "Follow" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /Friend/ })
    ).not.toBeVisible();

    // Post stats should NOT be visible
    await expect(page.getByText(/\d+ posts/)).not.toBeVisible();
    await expect(page.getByText(/\d+ followers/)).not.toBeVisible();

    // Content tabs should NOT be visible
    await expect(page.locator('[role="tablist"]')).not.toBeVisible();
  });

  test("blocked-by-them profile hides block button", async ({ browser }) => {
    // TEST_USER_2 blocks TEST_USER
    await createBlock(pool, user2Id, user1Id);

    const context = await browser.newContext({
      storageState: "e2e/auth/user.json",
    });
    const page = await context.newPage();

    await expect(async () => {
      await page.goto(`/${TEST_USER_2.username}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("text=This content is unavailable")
      ).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    // Block button should NOT be visible when blocked by them
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).not.toBeVisible();

    // Action buttons should NOT be visible
    await expect(
      page.getByRole("button", { name: "Follow" })
    ).not.toBeVisible();

    await context.close();
  });
});

test.describe("Blocked Users Page", () => {
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
    await cleanupBlocks(pool, [user1Id, user2Id]);
  });

  test.afterEach(async () => {
    await cleanupBlocks(pool, [user1Id, user2Id]);
  });

  test("shows empty state when no users are blocked", async ({ page }) => {
    await page.goto("/blocked");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("h1", { hasText: "Blocked Users" })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-testid="no-blocked-users"]')
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator("text=You haven't blocked anyone")
    ).toBeVisible();
  });

  test("shows blocked user in the list", async ({ page }) => {
    await createBlock(pool, user1Id, user2Id);

    await page.goto("/blocked");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("h1", { hasText: "Blocked Users" })
    ).toBeVisible({ timeout: 10000 });

    // Blocked users list should be visible
    const list = page.locator('[data-testid="blocked-users-list"]');
    await expect(list).toBeVisible({ timeout: 5000 });

    // Should show the blocked user's username
    await expect(
      list.locator(`text=@${TEST_USER_2.username}`)
    ).toBeVisible();

    // Should show an unblock button
    await expect(
      list.locator(`[data-testid="unblock-button-${user2Id}"]`)
    ).toBeVisible();
  });

  test("unblock button removes user from blocked list", async ({ page }) => {
    await createBlock(pool, user1Id, user2Id);

    await page.goto("/blocked");
    await page.reload();
    await page.waitForLoadState("networkidle");

    const list = page.locator('[data-testid="blocked-users-list"]');
    await expect(list).toBeVisible({ timeout: 10000 });

    // Click unblock
    const unblockButton = page.locator(
      `[data-testid="unblock-button-${user2Id}"]`
    );
    await expect(unblockButton).toBeVisible({ timeout: 5000 });
    await unblockButton.click();

    // Wait for the server action to complete
    await expect(async () => {
      const text = await unblockButton.textContent();
      expect(text).not.toBe("Unblock");
    }).toPass({ timeout: 15000 });

    // Navigate away and back to get fresh server render
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    await page.goto("/blocked");
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator('[data-testid="no-blocked-users"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("profile settings page has link to blocked users", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.reload();
    await page.waitForLoadState("networkidle");

    const blockedLink = page.locator('[data-testid="blocked-users-link"]');
    await expect(blockedLink).toBeVisible({ timeout: 10000 });
    await expect(blockedLink).toHaveText(/Blocked Users/);

    // Click the link and verify navigation
    await blockedLink.click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("h1", { hasText: "Blocked Users" })
    ).toBeVisible({ timeout: 10000 });
  });
});
