import { test, expect } from "../fixtures/auth";
import { TEST_USER, seedTestUser } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function seedContentViolation(): Promise<string> {
  const pool = createPool();
  try {
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const userId = user.rows[0].id;

    // Create a dummy post for the violation to reference
    const postId = `post_e2e_violation_${Date.now()}`;
    await pool.query(
      `INSERT INTO "Post" (id, content, "authorId", "createdAt", "updatedAt", "isSensitive", "isNsfw", "isGraphicNudity", "isPinned")
       VALUES ($1, '"violation test post"', $2, NOW(), NOW(), false, false, false, false)`,
      [postId, userId]
    );

    // Create a content violation
    const violation = await pool.query(
      `INSERT INTO "ContentViolation" (id, "userId", "postId", type, confidence, action, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'nsfw_unmarked', 0.952, 'auto_flagged', NOW())
       RETURNING id`,
      [userId, postId]
    );

    return violation.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function cleanupViolations() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(`DELETE FROM "ContentViolation" WHERE "userId" = ANY($1)`, [ids]);
    await pool.query(
      `DELETE FROM "Post" WHERE "authorId" = ANY($1) AND id LIKE 'post_e2e_violation_%'`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Content Appeals @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await cleanupViolations();
  });

  test.afterAll(async () => {
    await cleanupViolations();
  });

  // --- Appeals Page ---

  test("appeals page is accessible", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/settings/appeals");
    await expect(page).toHaveURL(/\/settings\/appeals/);
    await expect(page.locator("text=Content Violations")).toBeVisible({ timeout: 10000 });
  });

  test("shows empty state when no violations", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupViolations();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    await expect(page.locator("text=/no content violations/i")).toBeVisible({ timeout: 10000 });
  });

  test("shows violation card when violations exist", async ({ page, forceLogin }) => {
    await forceLogin;
    await seedContentViolation();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    // Should show the violation type badge
    await expect(page.locator("text=/Unmarked NSFW/i")).toBeVisible({ timeout: 10000 });

    // Should show auto-flagged status
    await expect(page.locator("text=/Auto-flagged/i")).toBeVisible();

    // Should show confidence
    await expect(page.locator("text=/95/")).toBeVisible();
  });

  test("contest button opens appeal form", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupViolations();
    await seedContentViolation();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    // Click contest button
    const contestButton = page.getByRole("button", { name: /contest this strike/i });
    await expect(contestButton).toBeVisible({ timeout: 10000 });
    await contestButton.click();

    // Textarea should appear
    const textarea = page.locator('textarea[name="reason"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Submit button should appear
    await expect(page.getByRole("button", { name: /submit appeal/i })).toBeVisible();
  });

  test("appeal form validates minimum length", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupViolations();
    await seedContentViolation();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    const contestButton = page.getByRole("button", { name: /contest this strike/i });
    await contestButton.click();

    const textarea = page.locator('textarea[name="reason"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Enter too-short reason
    await textarea.fill("short");

    await page.getByRole("button", { name: /submit appeal/i }).click();
    await page.waitForTimeout(2000);

    // Should show validation error or the form should remain open
    // (min length is 10 chars, "short" is only 5)
    await expect(textarea).toBeVisible();
  });

  test("can submit appeal with valid reason", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupViolations();
    await seedContentViolation();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    const contestButton = page.getByRole("button", { name: /contest this strike/i });
    await contestButton.click();

    const textarea = page.locator('textarea[name="reason"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    await textarea.fill(
      "I believe this flag was made in error. The content does not contain NSFW material."
    );

    await page.getByRole("button", { name: /submit appeal/i }).click();

    // Should show success message
    await expect(page.locator("text=/appeal has been submitted/i")).toBeVisible({
      timeout: 10000,
    });
  });

  test("cancel button closes appeal form", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupViolations();
    await seedContentViolation();

    await page.goto("/settings/appeals");
    await page.waitForTimeout(2000);

    const contestButton = page.getByRole("button", { name: /contest this strike/i });
    await contestButton.click();

    const textarea = page.locator('textarea[name="reason"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Textarea should be hidden
    await expect(textarea).not.toBeVisible({ timeout: 5000 });
  });
});
