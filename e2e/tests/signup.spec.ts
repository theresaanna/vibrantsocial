import { test, expect } from "@playwright/test";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupSignupTestUser(email: string) {
  const pool = createPool();
  try {
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (!user.rows[0]) return;
    const userId = user.rows[0].id;

    // Delete in dependency order
    const tables = [
      { table: "CommentReaction", column: "userId" },
      { table: "Like", column: "userId" },
      { table: "Bookmark", column: "userId" },
      { table: "Comment", column: "authorId" },
      { table: "Post", column: "authorId" },
      { table: "Notification", column: "targetUserId" },
      { table: "Notification", column: "actorId" },
      { table: "Follow", column: "followerId" },
      { table: "Follow", column: "followingId" },
      { table: "FriendRequest", column: "senderId" },
      { table: "FriendRequest", column: "receiverId" },
      { table: "VerificationToken", column: "identifier" },
      { table: "Session", column: "userId" },
      { table: "Account", column: "userId" },
    ];

    for (const { table, column } of tables) {
      if (column === "identifier") {
        await pool.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [email]);
        await pool.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [`email-verify:${email}`]);
      } else {
        await pool.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [userId]);
      }
    }

    await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
  } finally {
    await pool.end();
  }
}

const SIGNUP_EMAIL = "e2e-signup-test@example.com";
const SIGNUP_USERNAME = "e2e_signup_user";

test.describe("Signup Flow @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await cleanupSignupTestUser(SIGNUP_EMAIL);
  });

  test.afterAll(async () => {
    await cleanupSignupTestUser(SIGNUP_EMAIL);
  });

  // --- Page Rendering ---

  test("signup page renders form fields", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/signup/, { timeout: 10000 });

    // Should show all form fields
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="dateOfBirth"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('input[name="agreeToTos"]')).toBeVisible();

    // Submit button
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();

    await context.close();
  });

  test("signup page shows OAuth buttons", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    // Should show Google and Discord OAuth options
    await expect(page.locator("text=/continue with google/i")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=/continue with discord/i")).toBeVisible();

    await context.close();
  });

  // --- Validation ---

  test("validates password mismatch", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="username"]').fill("testuser123");
    await page.locator('input[name="dateOfBirth"]').fill("2000-01-15");
    await page.locator('input[name="password"]').fill("ValidPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("DifferentPassword!");
    await page.locator('input[name="agreeToTos"]').check();

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(3000);
    const error = page.locator("text=/passwords do not match|don't match/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("validates short password", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="username"]').fill("testuser123");
    await page.locator('input[name="dateOfBirth"]').fill("2000-01-15");
    await page.locator('input[name="password"]').fill("short");
    await page.locator('input[name="confirmPassword"]').fill("short");
    await page.locator('input[name="agreeToTos"]').check();

    await page.getByRole("button", { name: /create account/i }).click();

    // HTML5 minLength validation prevents submission — form stays on signup page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/signup/);

    // Password field should be marked invalid by browser validation
    const passwordInput = page.locator('input[name="password"]');
    const isInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);

    await context.close();
  });

  test("validates invalid username format", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="username"]').fill("bad user!@#");
    await page.locator('input[name="dateOfBirth"]').fill("2000-01-15");
    await page.locator('input[name="password"]').fill("ValidPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
    await page.locator('input[name="agreeToTos"]').check();

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(3000);
    const error = page.locator("text=/letters, numbers, and underscores/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("validates underage signup", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    // Set date to make user 15 years old
    const now = new Date();
    const underageDate = new Date(now.getFullYear() - 15, now.getMonth(), now.getDate());
    const dateStr = underageDate.toISOString().split("T")[0];

    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="username"]').fill("testuser123");
    await page.locator('input[name="dateOfBirth"]').fill(dateStr);
    await page.locator('input[name="password"]').fill("ValidPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
    await page.locator('input[name="agreeToTos"]').check();

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(3000);
    const error = page.locator("text=/at least 18/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("requires terms of service agreement", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="username"]').fill("testuser123");
    await page.locator('input[name="dateOfBirth"]').fill("2000-01-15");
    await page.locator('input[name="password"]').fill("ValidPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
    // Do NOT check ToS

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(3000);
    const error = page.locator("text=/agree to the Terms/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  // --- Username Availability ---

  test("shows username availability check", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    const usernameInput = page.locator('input[name="username"]');
    await usernameInput.fill("e2e_testuser");

    // Should show availability status after debounce
    await page.waitForTimeout(500);
    const availabilityText = page.locator("text=/already taken|is available/i");
    await expect(availabilityText).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  // --- Duplicate Email ---

  test("shows error for existing email", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup");

    // Use the existing test user's email
    await page.locator('input[name="email"]').fill("e2e-test@example.com");
    await page.locator('input[name="username"]').fill("e2e_unique_signup");
    await page.locator('input[name="dateOfBirth"]').fill("2000-01-15");
    await page.locator('input[name="password"]').fill("ValidPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
    await page.locator('input[name="agreeToTos"]').check();

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForTimeout(3000);
    const error = page.locator("text=/already exists|already taken/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  // --- Referral Code ---

  test("signup page preserves referral code from URL", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/signup?ref=test_referral_code");

    // The referral code should be preserved as a hidden input
    const hiddenInput = page.locator('input[name="referralCode"]');
    await expect(hiddenInput).toHaveValue("test_referral_code");

    await context.close();
  });

  // --- Authenticated Redirect ---

  test("authenticated user accessing signup redirects to feed", async ({ page }) => {
    // page has stored auth state
    await page.goto("/signup");

    // Should redirect to feed since already logged in
    await expect(page).toHaveURL(/\/(feed|compose)/, { timeout: 10000 });
  });
});
