import { test, expect } from "../fixtures/auth";
import pg from "pg";
import bcrypt from "bcryptjs";
import { TEST_USER } from "../helpers/db";
import { TOTP } from "otpauth";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

// --------------------------------------------------------------------------
// DB helpers
// --------------------------------------------------------------------------

/** Set the test user's TOTP secret (encrypted) and enable 2FA. */
async function enable2FAForTestUser(secret: string, encryptedSecret: string) {
  const pool = createPool();
  try {
    // Hash some backup codes for testing
    const backupCodes = ["test-0001", "test-0002", "test-0003"];
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c.replace("-", ""), 8))
    );

    await pool.query(
      `UPDATE "User" SET "twoFactorEnabled" = true, "twoFactorSecret" = $1, "twoFactorBackupCodes" = $2 WHERE email = $3`,
      [encryptedSecret, hashedCodes, TEST_USER.email]
    );
    return backupCodes;
  } finally {
    await pool.end();
  }
}

/** Disable 2FA for the test user. */
async function disable2FAForTestUser() {
  const pool = createPool();
  try {
    await pool.query(
      `UPDATE "User" SET "twoFactorEnabled" = false, "twoFactorSecret" = NULL, "twoFactorBackupCodes" = '{}' WHERE email = $1`,
      [TEST_USER.email]
    );
    // Clean up any WebAuthn credentials
    const user = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    if (user.rows[0]) {
      await pool.query(
        'DELETE FROM "WebAuthnCredential" WHERE "userId" = $1',
        [user.rows[0].id]
      );
    }
  } finally {
    await pool.end();
  }
}

/** Get 2FA status from the DB. */
async function get2FAStatus(): Promise<{
  enabled: boolean;
  hasSecret: boolean;
  backupCodeCount: number;
}> {
  const pool = createPool();
  try {
    const result = await pool.query(
      'SELECT "twoFactorEnabled", "twoFactorSecret", "twoFactorBackupCodes" FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    const row = result.rows[0];
    return {
      enabled: row?.twoFactorEnabled ?? false,
      hasSecret: !!row?.twoFactorSecret,
      backupCodeCount: row?.twoFactorBackupCodes?.length ?? 0,
    };
  } finally {
    await pool.end();
  }
}

/** Generate a current TOTP code for the given secret. */
function generateCurrentTOTP(secret: string): string {
  const totp = new TOTP({
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

/**
 * Simple encrypt matching the app's two-factor.ts encryptSecret.
 * Requires TWO_FACTOR_ENCRYPTION_KEY env var.
 */
function encryptSecret(plaintext: string): string {
  const crypto = require("crypto");
  const key = Buffer.from(process.env.TWO_FACTOR_ENCRYPTION_KEY!, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

test.describe("Two-Factor Authentication", () => {
  test.afterEach(async () => {
    await disable2FAForTestUser();
  });

  test.describe("Setup flow", () => {
    test("shows 2FA section on profile page", async ({ page, forceLogin }) => {
      await forceLogin;
      await page.goto("/profile");
      await expect(page.getByTestId("two-factor-section")).toBeVisible();
      await expect(page.getByText("Two-Factor Authentication")).toBeVisible();
      await expect(page.getByText("Not enabled")).toBeVisible();
    });

    test("shows enable button for credentials users", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");
      await expect(page.getByTestId("enable-2fa-button")).toBeVisible();
    });

    test("begins TOTP setup and shows QR code", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");

      await page.getByTestId("enable-2fa-button").click();

      // Should show QR code and secret
      await expect(page.getByTestId("totp-qr-code")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId("totp-secret-display")).toBeVisible();
      await expect(page.getByTestId("setup-totp-input")).toBeVisible();
    });

    test("rejects incorrect TOTP code during setup", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");

      await page.getByTestId("enable-2fa-button").click();
      await expect(page.getByTestId("setup-totp-input")).toBeVisible({
        timeout: 10000,
      });

      // Enter a wrong code
      await page.getByTestId("setup-totp-input").fill("000000");
      await page.getByTestId("verify-totp-button").click();

      await expect(page.getByTestId("2fa-message")).toContainText(
        "Invalid code"
      );

      // 2FA should not be enabled in DB
      const status = await get2FAStatus();
      expect(status.enabled).toBe(false);
    });

    test("enables 2FA with valid TOTP code and shows backup codes", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");

      await page.getByTestId("enable-2fa-button").click();
      await expect(page.getByTestId("totp-secret-display")).toBeVisible({
        timeout: 10000,
      });

      // Read the displayed secret
      const secretText = await page
        .getByTestId("totp-secret-display")
        .textContent();
      expect(secretText).toBeTruthy();

      // Generate a valid code from the displayed secret
      const code = generateCurrentTOTP(secretText!.trim());

      await page.getByTestId("setup-totp-input").fill(code);
      await page.getByTestId("verify-totp-button").click();

      // Should show backup codes
      await expect(page.getByTestId("backup-codes-list")).toBeVisible({
        timeout: 10000,
      });

      // Verify 2FA is enabled in DB
      const status = await get2FAStatus();
      expect(status.enabled).toBe(true);
      expect(status.hasSecret).toBe(true);
      expect(status.backupCodeCount).toBe(10);
    });

    test("can dismiss backup codes and sees enabled status", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");

      // Quick enable setup
      await page.getByTestId("enable-2fa-button").click();
      await expect(page.getByTestId("totp-secret-display")).toBeVisible({
        timeout: 10000,
      });
      const secret = (
        await page.getByTestId("totp-secret-display").textContent()
      )!.trim();
      const code = generateCurrentTOTP(secret);
      await page.getByTestId("setup-totp-input").fill(code);
      await page.getByTestId("verify-totp-button").click();
      await expect(page.getByTestId("backup-codes-list")).toBeVisible({
        timeout: 10000,
      });

      // Click done
      await page.getByTestId("done-backup-codes").click();

      // Should show enabled status
      await expect(page.getByTestId("two-factor-section").getByText("Enabled")).toBeVisible();
      await expect(page.getByTestId("disable-2fa-button")).toBeVisible();
    });
  });

  test.describe("Disable flow", () => {
    test("disables 2FA with correct password", async ({
      page,
      forceLogin,
    }) => {
      // Pre-enable 2FA in DB
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await forceLogin;
      await page.goto("/profile");

      await expect(page.getByTestId("two-factor-section").getByText("Enabled")).toBeVisible();
      await page.getByTestId("disable-2fa-button").click();

      await expect(page.getByTestId("2fa-password-input")).toBeVisible();
      await page.getByTestId("2fa-password-input").fill(TEST_USER.password);
      await page.getByTestId("confirm-disable-2fa").click();

      await expect(page.getByText("Not enabled")).toBeVisible({
        timeout: 10000,
      });

      // Verify in DB
      const status = await get2FAStatus();
      expect(status.enabled).toBe(false);
      expect(status.hasSecret).toBe(false);
    });

    test("rejects wrong password when disabling", async ({
      page,
      forceLogin,
    }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await forceLogin;
      await page.goto("/profile");

      await page.getByTestId("disable-2fa-button").click();
      await page.getByTestId("2fa-password-input").fill("wrongpassword");
      await page.getByTestId("confirm-disable-2fa").click();

      await expect(page.getByTestId("2fa-message")).toContainText(
        "Incorrect password"
      );

      // Should still be enabled
      const status = await get2FAStatus();
      expect(status.enabled).toBe(true);
    });
  });

  test.describe("Login with 2FA", () => {
    test("redirects to 2FA page after entering correct credentials", async ({
      page,
    }) => {
      // Pre-enable 2FA
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      // Log out first by navigating directly to login
      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      // Should redirect to 2FA page
      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });
      await expect(
        page.getByText("Two-Factor Authentication")
      ).toBeVisible();
      await expect(page.getByTestId("totp-input")).toBeVisible();
    });

    test("completes login with valid TOTP code", async ({ page }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });

      // Enter valid TOTP
      const code = generateCurrentTOTP(secret);
      await page.getByTestId("totp-input").fill(code);
      await page.getByTestId("totp-submit").click();

      // Should redirect to complete-profile or feed
      await page.waitForURL(/(\/feed|\/complete-profile)/, {
        timeout: 15000,
      });
    });

    test("rejects incorrect TOTP code during login", async ({ page }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });

      await page.getByTestId("totp-input").fill("000000");
      await page.getByTestId("totp-submit").click();

      await expect(page.getByTestId("2fa-error")).toContainText(
        "Invalid code"
      );
    });

    test("can use backup code to log in", async ({ page }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      const backupCodes = await enable2FAForTestUser(secret, encrypted);

      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });

      // Switch to backup code mode
      await page.getByTestId("switch-to-backup").click();
      await expect(page.getByTestId("backup-code-input")).toBeVisible();

      // Enter a valid backup code
      await page.getByTestId("backup-code-input").fill(backupCodes[0]);
      await page.getByTestId("backup-code-submit").click();

      // Should complete login
      await page.waitForURL(/(\/feed|\/complete-profile)/, {
        timeout: 15000,
      });

      // Verify the backup code was consumed (one fewer code)
      const status = await get2FAStatus();
      expect(status.backupCodeCount).toBe(2); // Was 3, used 1
    });

    test("rejects invalid backup code during login", async ({ page }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });

      await page.getByTestId("switch-to-backup").click();
      await page.getByTestId("backup-code-input").fill("wrong-code");
      await page.getByTestId("backup-code-submit").click();

      await expect(page.getByTestId("2fa-error")).toContainText(
        "Invalid backup code"
      );
    });

    test("shows back to login link on 2FA page", async ({ page }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await page.goto("/login");
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/login/two-factor**", { timeout: 15000 });

      const backLink = page.getByText("Back to login");
      await expect(backLink).toBeVisible();
      expect(await backLink.getAttribute("href")).toBe("/login");
    });
  });

  test.describe("Backup codes", () => {
    test("regenerates backup codes with password", async ({
      page,
      forceLogin,
    }) => {
      const secret = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(secret);
      await enable2FAForTestUser(secret, encrypted);

      await forceLogin;
      await page.goto("/profile");

      await expect(page.getByTestId("two-factor-section").getByText("Enabled")).toBeVisible();

      // Click regenerate (shares the disable flow button which shows password input)
      await page.getByTestId("show-regenerate-backup").click();
      await expect(page.getByTestId("2fa-password-input")).toBeVisible();
      await page.getByTestId("2fa-password-input").fill(TEST_USER.password);
      await page.getByTestId("confirm-regenerate-codes").click();

      // Should show new backup codes
      await expect(page.getByTestId("backup-codes-list")).toBeVisible({
        timeout: 10000,
      });

      // Verify in DB — should have 10 new codes
      const status = await get2FAStatus();
      expect(status.backupCodeCount).toBe(10);
    });

    test("shows copy button for backup codes", async ({
      page,
      forceLogin,
    }) => {
      await forceLogin;
      await page.goto("/profile");

      // Enable 2FA
      await page.getByTestId("enable-2fa-button").click();
      await expect(page.getByTestId("totp-secret-display")).toBeVisible({
        timeout: 10000,
      });
      const secretText = (
        await page.getByTestId("totp-secret-display").textContent()
      )!.trim();
      const code = generateCurrentTOTP(secretText);
      await page.getByTestId("setup-totp-input").fill(code);
      await page.getByTestId("verify-totp-button").click();

      await expect(page.getByTestId("backup-codes-list")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByTestId("copy-backup-codes")).toBeVisible();
    });
  });

  test.describe("2FA page without token", () => {
    test("shows error message when no token provided", async ({ page }) => {
      await page.goto("/login/two-factor");
      await expect(page.getByText("Invalid or expired session")).toBeVisible();
      await expect(page.getByText("log in again")).toBeVisible();
    });
  });
});
