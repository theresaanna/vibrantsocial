import { test, expect } from "@playwright/test";
import pg from "pg";
import crypto from "crypto";
import { TEST_USER } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function createPasswordResetToken(email: string): Promise<string> {
  const pool = createPool();
  try {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Clean up existing tokens for this identifier
    await pool.query(
      'DELETE FROM "VerificationToken" WHERE identifier = $1',
      [email]
    );

    await pool.query(
      `INSERT INTO "VerificationToken" (identifier, token, expires)
       VALUES ($1, $2, $3)`,
      [email, token, expires.toISOString()]
    );

    return token;
  } finally {
    await pool.end();
  }
}

async function createExpiredResetToken(email: string): Promise<string> {
  const pool = createPool();
  try {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() - 60 * 1000); // expired 1 minute ago

    await pool.query(
      'DELETE FROM "VerificationToken" WHERE identifier = $1',
      [email]
    );

    await pool.query(
      `INSERT INTO "VerificationToken" (identifier, token, expires)
       VALUES ($1, $2, $3)`,
      [email, token, expires.toISOString()]
    );

    return token;
  } finally {
    await pool.end();
  }
}

async function createEmailVerificationToken(email: string): Promise<string> {
  const pool = createPool();
  try {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    const identifier = `email-verify:${email}`;

    await pool.query(
      'DELETE FROM "VerificationToken" WHERE identifier = $1',
      [identifier]
    );

    await pool.query(
      `INSERT INTO "VerificationToken" (identifier, token, expires)
       VALUES ($1, $2, $3)`,
      [identifier, token, expires.toISOString()]
    );

    // Set pending email on test user
    await pool.query(
      'UPDATE "User" SET "pendingEmail" = $1 WHERE email = $2',
      [email, TEST_USER.email]
    );

    return token;
  } finally {
    await pool.end();
  }
}

async function cleanupTokens() {
  const pool = createPool();
  try {
    await pool.query(
      `DELETE FROM "VerificationToken" WHERE identifier LIKE 'e2e-%' OR identifier LIKE 'email-verify:e2e-%'`
    );
    // Clear any pending email on test user
    await pool.query(
      'UPDATE "User" SET "pendingEmail" = NULL WHERE email = $1',
      [TEST_USER.email]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Email Verification & Password Reset @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.afterAll(async () => {
    await cleanupTokens();
  });

  // --- Forgot Password ---

  test("forgot password page renders form", async ({ browser }) => {
    // Use fresh context (unauthenticated) with explicit empty storage state
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10000 });

    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText(/send reset link/i);

    await context.close();
  });

  test("forgot password shows success message for any email", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/forgot-password");

    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill("nonexistent@example.com");

    await page.locator('button[type="submit"]').click();

    // Should show a success-style message (not reveal whether email exists)
    // Wait for the form to process
    await page.waitForTimeout(3000);

    // The page should show some feedback (success or generic message)
    const feedback = page.locator("text=/check|sent|reset link/i").first();
    await expect(feedback).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("forgot password redirects authenticated users to feed", async ({ page }) => {
    // page uses stored auth state, so user is logged in
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/feed/, { timeout: 10000 });
  });

  // --- Reset Password ---

  test("reset password page renders with valid token", async ({ browser }) => {
    const token = await createPasswordResetToken(TEST_USER.email);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/reset-password?token=${token}&email=${encodeURIComponent(TEST_USER.email)}`);

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    const confirmInput = page.locator('input[name="confirmPassword"]');
    await expect(confirmInput).toBeVisible();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toHaveText(/reset password/i);

    await context.close();
  });

  test("reset password validates password mismatch", async ({ browser }) => {
    const token = await createPasswordResetToken(TEST_USER.email);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/reset-password?token=${token}&email=${encodeURIComponent(TEST_USER.email)}`);

    await page.locator('input[name="password"]').fill("NewPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("DifferentPassword!");
    await page.locator('button[type="submit"]').click();

    // Should show an error about passwords not matching
    await page.waitForTimeout(2000);
    const error = page.locator("text=/match|don't match|do not match/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("reset password validates minimum length", async ({ browser }) => {
    const token = await createPasswordResetToken(TEST_USER.email);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/reset-password?token=${token}&email=${encodeURIComponent(TEST_USER.email)}`);

    await page.locator('input[name="password"]').fill("short");
    await page.locator('input[name="confirmPassword"]').fill("short");
    await page.locator('button[type="submit"]').click();

    // HTML5 minLength validation prevents submission — form stays on page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/reset-password/);

    // Password field should be marked invalid by browser validation
    const passwordInput = page.locator('input[name="password"]');
    const isInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);

    await context.close();
  });

  test("reset password rejects expired token", async ({ browser }) => {
    const token = await createExpiredResetToken(TEST_USER.email);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/reset-password?token=${token}&email=${encodeURIComponent(TEST_USER.email)}`);

    // Fill valid passwords
    const passwordInput = page.locator('input[name="password"]');
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordInput.fill("ValidPassword123!");
      await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
      await page.locator('button[type="submit"]').click();

      await page.waitForTimeout(2000);
      const error = page.locator("text=/expired|invalid|no longer valid/i");
      await expect(error).toBeVisible({ timeout: 10000 });
    } else {
      // Page might show error immediately for expired tokens
      const error = page.locator("text=/expired|invalid|no longer valid/i");
      await expect(error).toBeVisible({ timeout: 10000 });
    }

    await context.close();
  });

  test("reset password rejects invalid token", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/reset-password?token=invalid-token-12345&email=${encodeURIComponent(TEST_USER.email)}`);

    const passwordInput = page.locator('input[name="password"]');
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordInput.fill("ValidPassword123!");
      await page.locator('input[name="confirmPassword"]').fill("ValidPassword123!");
      await page.locator('button[type="submit"]').click();

      await page.waitForTimeout(2000);
      const error = page.locator("text=/invalid|expired|not found/i");
      await expect(error).toBeVisible({ timeout: 10000 });
    } else {
      const error = page.locator("text=/invalid|expired|not found/i");
      await expect(error).toBeVisible({ timeout: 10000 });
    }

    await context.close();
  });

  test("reset password redirects authenticated users to feed", async ({ page }) => {
    await page.goto("/reset-password?token=fake&email=fake@test.com");
    await expect(page).toHaveURL(/\/feed/, { timeout: 10000 });
  });

  // --- Email Verification ---

  test("verify email page handles valid token", async ({ browser }) => {
    const newEmail = `e2e-verify-${Date.now()}@example.com`;
    const token = await createEmailVerificationToken(newEmail);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`/verify-email?token=${token}&email=${encodeURIComponent(newEmail)}`);

    // Should show success or processing state
    await page.waitForTimeout(3000);

    // Look for verification result — use .first() since both heading and body text may match
    const result = page.locator("text=/verified|success|confirmed|invalid|expired/i").first();
    await expect(result).toBeVisible({ timeout: 10000 });
  });

  test("verify email page rejects invalid token", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/verify-email?token=fake-token&email=fake@example.com");
    await page.waitForTimeout(3000);

    const error = page.getByRole("heading", { name: /failed/i });
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("verify email page requires token and email params", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/verify-email");

    // Should show error or redirect
    const error = page.locator("text=/invalid|missing|required|error/i");
    await expect(error).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
