import { test, expect } from "../fixtures/auth";
import pg from "pg";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function setPhoneVerified(email: string, phoneNumber: string) {
  const pool = createPool();
  try {
    await pool.query(
      `UPDATE "User" SET "phoneNumber" = $1, "phoneVerified" = NOW() WHERE email = $2`,
      [phoneNumber, email]
    );
  } finally {
    await pool.end();
  }
}

async function clearPhoneVerified(email: string) {
  const pool = createPool();
  try {
    await pool.query(
      `UPDATE "User" SET "phoneNumber" = NULL, "phoneVerified" = NULL WHERE email = $1`,
      [email]
    );
  } finally {
    await pool.end();
  }
}

async function cleanupPhoneBlocks() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "PhoneBlock" WHERE "blockerId" = ANY($1)`, [ids]);
    await pool.query(
      `DELETE FROM "Block" WHERE "blockerId" = ANY($1) OR "blockedId" = ANY($1)`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Phone-based Blocking", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
  });

  test.afterAll(async () => {
    await cleanupPhoneBlocks();
    await clearPhoneVerified(TEST_USER_2.email);
  });

  test("phone block checkbox appears when target has verified phone", async ({ page, forceLogin }) => {
    await forceLogin;

    // Give user 2 a verified phone
    await setPhoneVerified(TEST_USER_2.email, "+15559876543");

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Click the block button
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    // Dialog should appear
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Phone block checkbox should be visible
    const checkbox = page.locator('[data-testid="block-by-phone-checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(
      page.getByText("Also block all accounts using the same phone number")
    ).toBeVisible();

    // Cancel to clean up
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("phone block checkbox does NOT appear when target has no verified phone", async ({ page, forceLogin }) => {
    await forceLogin;

    // Remove phone verification from user 2
    await clearPhoneVerified(TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Click the block button
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    // Dialog should appear
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Phone block checkbox should NOT be visible
    const checkbox = page.locator('[data-testid="block-by-phone-checkbox"]');
    await expect(checkbox).not.toBeVisible();

    // Cancel to clean up
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("blocking with phone block option creates PhoneBlock record", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupPhoneBlocks();

    // Give user 2 a verified phone
    await setPhoneVerified(TEST_USER_2.email, "+15559876543");

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Click block button
    const blockButton = page.locator('[data-testid="profile-block-button"]');
    await expect(blockButton).toBeVisible({ timeout: 5000 });
    await blockButton.click();

    // Check the phone block checkbox
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const checkbox = page.locator('[data-testid="block-by-phone-checkbox"]');
    await checkbox.check();

    // Confirm block
    await dialog.getByRole("button", { name: "Block" }).click();

    // Should see "blocked" message after page updates
    await expect(
      page.locator("text=You have blocked this user")
    ).toBeVisible({ timeout: 10000 });

    // Verify PhoneBlock record was created in DB
    const pool = createPool();
    try {
      const user1 = await pool.query(
        `SELECT id FROM "User" WHERE email = $1`,
        [TEST_USER.email]
      );
      const result = await pool.query(
        `SELECT * FROM "PhoneBlock" WHERE "blockerId" = $1 AND "phoneNumber" = '+15559876543'`,
        [user1.rows[0].id]
      );
      expect(result.rows.length).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
