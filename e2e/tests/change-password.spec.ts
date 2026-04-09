import { test, expect } from "../fixtures/auth";
import pg from "pg";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { TEST_USER } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

/** Reset the test user's password to the canonical value after each test. */
async function resetPassword() {
  const pool = createPool();
  try {
    const hash = await bcrypt.hash(TEST_USER.password, 12);
    await pool.query(
      'UPDATE "User" SET "passwordHash" = $1 WHERE email = $2',
      [hash, TEST_USER.email]
    );
  } finally {
    await pool.end();
  }
}

/** Read the most recent verification token for the test user's email. */
async function getResetToken(): Promise<string | null> {
  const pool = createPool();
  try {
    const result = await pool.query(
      'SELECT token FROM "VerificationToken" WHERE identifier = $1 ORDER BY expires DESC LIMIT 1',
      [TEST_USER.email]
    );
    return result.rows[0]?.token ?? null;
  } finally {
    await pool.end();
  }
}

test.describe("Change password (email flow)", () => {
  test.afterEach(async () => {
    await resetPassword();
    // Clean up verification tokens
    const pool = createPool();
    try {
      await pool.query(
        'DELETE FROM "VerificationToken" WHERE identifier = $1',
        [TEST_USER.email]
      );
    } finally {
      await pool.end();
    }
  });

  test("shows change password section near the top of profile", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await expect(page.getByText("Change Password")).toBeVisible();
    await expect(
      page.getByTestId("change-password-submit")
    ).toBeVisible();
    await expect(
      page.getByText(/password reset link to your email/i)
    ).toBeVisible();
  });

  test("sends reset email and creates verification token", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");

    await page.getByTestId("change-password-submit").click();

    await expect(page.getByTestId("change-password-message")).toContainText(
      "reset link sent"
    );

    // Verify a token was created in the database
    const token = await getResetToken();
    expect(token).toBeTruthy();
  });

  test("reset link works for authenticated user (full flow)", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");

    // Request the reset email
    await page.getByTestId("change-password-submit").click();
    await expect(page.getByTestId("change-password-message")).toContainText(
      "reset link sent"
    );

    // Grab the token from the DB and navigate to the reset page directly
    const token = await getResetToken();
    expect(token).toBeTruthy();

    await page.goto(
      `/reset-password?token=${encodeURIComponent(token!)}&email=${encodeURIComponent(TEST_USER.email)}`
    );

    // Should see the reset form (not be redirected away)
    await expect(
      page.getByRole("heading", { name: /choose a new password/i })
    ).toBeVisible();

    // Fill in the new password form
    const newPassword = "ChangedViaEmail789!";
    await page.getByLabel(/^new password/i).fill(newPassword);
    await page.getByLabel(/confirm new password/i).fill(newPassword);
    await page.getByRole("button", { name: /reset password/i }).click();

    // Should see success
    await expect(
      page.getByText(/password.*reset.*successfully/i)
    ).toBeVisible();

    // Verify the password was actually changed in the DB
    const pool = createPool();
    try {
      const result = await pool.query(
        'SELECT "passwordHash" FROM "User" WHERE email = $1',
        [TEST_USER.email]
      );
      const isMatch = await bcrypt.compare(
        newPassword,
        result.rows[0].passwordHash
      );
      expect(isMatch).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
