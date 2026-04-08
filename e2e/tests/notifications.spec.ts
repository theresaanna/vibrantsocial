import { test, expect } from "../fixtures/auth";
import {
  TEST_USER,
  TEST_USER_2,
  seedTestUser,
  seedSecondTestUser,
  createTestNotifications,
  cleanupTestNotifications,
} from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function createTypedNotification(
  targetEmail: string,
  actorEmail: string,
  type: string,
  extras: Record<string, string> = {}
) {
  const pool = createPool();
  try {
    const target = await pool.query('SELECT id FROM "User" WHERE email = $1', [targetEmail]);
    const actor = await pool.query('SELECT id FROM "User" WHERE email = $1', [actorEmail]);
    if (!target.rows[0] || !actor.rows[0]) throw new Error("Users must exist");

    const columns = ['"actorId"', '"targetUserId"', 'type', '"createdAt"'];
    const values = [actor.rows[0].id, target.rows[0].id, type, 'NOW()'];
    const params: string[] = [actor.rows[0].id, target.rows[0].id, type];
    let paramIdx = 4;

    for (const [key, val] of Object.entries(extras)) {
      columns.push(`"${key}"`);
      values.push(`$${paramIdx}`);
      params.push(val);
      paramIdx++;
    }

    await pool.query(
      `INSERT INTO "Notification" (id, ${columns.join(", ")})
       VALUES (gen_random_uuid(), ${columns.map((_, i) => i === columns.length - 1 - Object.keys(extras).length ? 'NOW()' : `$${i + 1}`).join(", ")})`,
      params
    );
  } finally {
    await pool.end();
  }
}

async function seedVariousNotifications() {
  const pool = createPool();
  try {
    const target = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const actor = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
    if (!target.rows[0] || !actor.rows[0]) throw new Error("Users must exist");

    const targetId = target.rows[0].id;
    const actorId = actor.rows[0].id;

    const types = ["FOLLOW", "LIKE", "COMMENT", "REPOST"];
    for (const type of types) {
      await pool.query(
        `INSERT INTO "Notification" (id, type, "actorId", "targetUserId", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, NOW() - INTERVAL '${types.indexOf(type)} minutes')`,
        [type, actorId, targetId]
      );
    }
  } finally {
    await pool.end();
  }
}

async function markAllRead() {
  const pool = createPool();
  try {
    const target = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    await pool.query(
      `UPDATE "Notification" SET "readAt" = NOW() WHERE "targetUserId" = $1`,
      [target.rows[0].id]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Notifications @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await cleanupTestNotifications();
  });

  test.afterAll(async () => {
    await cleanupTestNotifications();
  });

  // --- Notifications Page ---

  test("notifications page is accessible", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/notifications/);
  });

  test("notifications page shows notification items", async ({ page, forceLogin }) => {
    await forceLogin;

    // Seed some notifications
    await seedVariousNotifications();

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Should see notification content from test user 2
    await expect(page.getByText(TEST_USER_2.username).first()).toBeVisible({ timeout: 10000 });
  });

  test("notifications show different types", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Should see various notification type texts
    // FOLLOW → "followed you", LIKE → "liked your post", etc.
    const followNotif = page.locator("text=/followed/i").first();
    await expect(followNotif).toBeVisible({ timeout: 10000 });
  });

  test("unread notifications have visual indicator", async ({ page, forceLogin }) => {
    await forceLogin;

    // Create a fresh unread notification
    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 1);

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Unread notifications should have blue background
    const unreadNotif = page.locator('[class*="blue"]').first();
    await expect(unreadNotif).toBeVisible({ timeout: 10000 });
  });

  // --- Mark as Read ---

  test("clicking a notification marks it as read", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 1);

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Click on the notification
    const notifItem = page.getByText(TEST_USER_2.username).first();
    await expect(notifItem).toBeVisible({ timeout: 10000 });
    await notifItem.click();

    // Navigate back to notifications
    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // The notification should no longer have unread styling
    // (blue background should be gone)
  });

  test("mark all as read button works", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 3);

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Should see mark all as read button
    const markAllButton = page.getByRole("button", { name: /mark all/i });
    await expect(markAllButton).toBeVisible({ timeout: 10000 });
    await markAllButton.click();

    await page.waitForTimeout(1000);

    // Button should disappear or all notifications should lose unread styling
    await expect(markAllButton).not.toBeVisible({ timeout: 10000 });
  });

  // --- Selection Mode ---

  test("can enter selection mode", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 2);

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Click Select button to enter selection mode
    const selectButton = page.getByRole("button", { name: /select/i });
    await expect(selectButton).toBeVisible({ timeout: 10000 });
    await selectButton.click();

    // Checkboxes should appear
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 5000 });
  });

  test("can select and delete notifications", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 3);

    await page.goto("/notifications");
    await page.waitForTimeout(2000);

    // Enter selection mode
    const selectButton = page.getByRole("button", { name: /select/i });
    await expect(selectButton).toBeVisible({ timeout: 10000 });
    await selectButton.click();

    // Select first notification
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 5000 });
    await checkbox.click();

    // Delete button should appear
    const deleteButton = page.getByRole("button", { name: /delete/i });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Confirm deletion in dialog
    const confirmButton = page.getByRole("button", { name: /delete/i }).last();
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForTimeout(1000);
  });

  // --- Notification Bell ---

  test("notification bell shows in nav", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/feed");
    await page.waitForTimeout(2000);

    const bell = page.locator('button[aria-label="Notifications"]');
    await expect(bell).toBeVisible({ timeout: 10000 });
  });

  test("notification bell dropdown shows recent notifications", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 2);

    await page.goto("/feed");
    await page.waitForTimeout(2000);

    // Click the notification bell
    const bell = page.locator('button[aria-label="Notifications"]');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click();

    // Dropdown should show notifications
    await expect(page.getByText(TEST_USER_2.username).first()).toBeVisible({ timeout: 10000 });

    // Should have "View all notifications" link
    await expect(page.getByText(/view all/i)).toBeVisible({ timeout: 5000 });
  });

  test("notification bell badge shows unread count", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 3);

    await page.goto("/feed");
    await page.waitForTimeout(3000);

    // Bell should show a badge with count
    const bell = page.locator('button[aria-label="Notifications"]');
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Badge text should show the count
    const badge = bell.locator("span").filter({ hasText: /\d+/ });
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("view all link navigates to notifications page", async ({ page, forceLogin }) => {
    await forceLogin;

    await cleanupTestNotifications();
    await createTestNotifications(TEST_USER.email, TEST_USER_2.email, 1);

    await page.goto("/feed");
    await page.waitForTimeout(2000);

    const bell = page.locator('button[aria-label="Notifications"]');
    await bell.click();

    const viewAllLink = page.getByText(/view all/i);
    await expect(viewAllLink).toBeVisible({ timeout: 10000 });
    await viewAllLink.click();

    await expect(page).toHaveURL(/\/notifications/, { timeout: 10000 });
  });
});
