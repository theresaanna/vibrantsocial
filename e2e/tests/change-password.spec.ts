import { test, expect } from "../fixtures/auth";
import { TEST_USER } from "../helpers/db";
import pg from "pg";
import bcrypt from "bcryptjs";

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

test.describe("Change password", () => {
  test.afterEach(async () => {
    await resetPassword();
  });

  test("shows change password section for credentials user", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await expect(
      page.getByTestId("current-password-input")
    ).toBeVisible();
    await expect(page.getByTestId("new-password-input")).toBeVisible();
    await expect(
      page.getByTestId("confirm-new-password-input")
    ).toBeVisible();
    await expect(
      page.getByTestId("change-password-submit")
    ).toBeVisible();
  });

  test("shows error for incorrect current password", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");

    await page.getByTestId("current-password-input").fill("WrongPassword!");
    await page.getByTestId("new-password-input").fill("BrandNewPass1!");
    await page
      .getByTestId("confirm-new-password-input")
      .fill("BrandNewPass1!");
    await page.getByTestId("change-password-submit").click();

    await expect(page.getByTestId("change-password-message")).toContainText(
      "Current password is incorrect"
    );
  });

  test("shows error when passwords do not match", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");

    await page.getByTestId("current-password-input").fill(TEST_USER.password);
    await page.getByTestId("new-password-input").fill("BrandNewPass1!");
    await page
      .getByTestId("confirm-new-password-input")
      .fill("MismatchPass1!");
    await page.getByTestId("change-password-submit").click();

    await expect(page.getByTestId("change-password-message")).toContainText(
      "Passwords do not match"
    );
  });

  test("successfully changes password", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto("/profile");

    const newPassword = "ChangedPass789!";

    await page.getByTestId("current-password-input").fill(TEST_USER.password);
    await page.getByTestId("new-password-input").fill(newPassword);
    await page.getByTestId("confirm-new-password-input").fill(newPassword);
    await page.getByTestId("change-password-submit").click();

    await expect(page.getByTestId("change-password-message")).toContainText(
      "Password changed successfully"
    );

    // Verify the new password works by checking it was hashed in the DB
    const pool = createPool();
    try {
      const result = await pool.query(
        'SELECT "passwordHash" FROM "User" WHERE email = $1',
        [TEST_USER.email]
      );
      const storedHash = result.rows[0].passwordHash;
      const isMatch = await bcrypt.compare(newPassword, storedHash);
      expect(isMatch).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
