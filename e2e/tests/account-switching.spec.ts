import { test, expect } from "../fixtures/auth";
import { TEST_USER, TEST_USER_2, cleanupLinkedAccountGroups } from "../helpers/db";

test.describe("Account Switching", () => {
  test.beforeEach(async () => {
    // Ensure clean state — no linked accounts
    await cleanupLinkedAccountGroups();
  });

  test.afterAll(async () => {
    await cleanupLinkedAccountGroups();
  });

  test("linked accounts section is visible on profile page", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const section = page.getByTestId("linked-accounts-section");
    await expect(section).toBeVisible({ timeout: 10000 });
    await expect(section.getByText("Linked Accounts")).toBeVisible();
    await expect(section.getByText("Link another account")).toBeVisible();
  });

  test("can open and close link account modal from profile", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Open the modal
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Link another account")).toBeVisible();

    // Verify form fields are present
    await expect(page.getByTestId("link-email-input")).toBeVisible();
    await expect(page.getByTestId("link-password-input")).toBeVisible();
    await expect(page.getByTestId("link-account-submit")).toBeVisible();

    // Close via the close button
    await page.getByLabel("Close").click();
    await expect(page.getByTestId("link-account-modal")).not.toBeVisible();
  });

  test("shows error for invalid credentials when linking", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });

    // Enter wrong credentials
    await page.getByTestId("link-email-input").fill("nonexistent@example.com");
    await page.getByTestId("link-password-input").fill("wrongpassword");
    await page.getByTestId("link-account-submit").click();

    // Wait for error message
    await expect(page.getByTestId("link-error")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("link-error")).toContainText(
      "Invalid email or password"
    );
  });

  test("can link a second account and see it in profile settings", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Open link modal
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });

    // Enter second test user credentials
    await page.getByTestId("link-email-input").fill(TEST_USER_2.email);
    await page.getByTestId("link-password-input").fill(TEST_USER_2.password);
    await page.getByTestId("link-account-submit").click();

    // Modal should close on success
    await expect(page.getByTestId("link-account-modal")).not.toBeVisible({
      timeout: 10000,
    });

    // The linked account should appear in the profile settings
    await expect(
      page.getByTestId(`linked-account-${TEST_USER_2.username}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(`@${TEST_USER_2.username}`)
    ).toBeVisible();
  });

  test("account switcher appears in header after linking", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Link the second account first
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("link-email-input").fill(TEST_USER_2.email);
    await page.getByTestId("link-password-input").fill(TEST_USER_2.password);
    await page.getByTestId("link-account-submit").click();
    await expect(page.getByTestId("link-account-modal")).not.toBeVisible({
      timeout: 10000,
    });

    // Reload to pick up the session update
    await page.reload();
    await page.waitForLoadState("networkidle");

    // The account switcher button should now be visible in the header
    await expect(page.getByTestId("account-switcher-button")).toBeVisible({
      timeout: 10000,
    });

    // Click the switcher
    await page.getByTestId("account-switcher-button").click();
    await expect(page.getByTestId("account-switcher-dropdown")).toBeVisible({
      timeout: 5000,
    });

    // Should show the second account
    await expect(
      page.getByTestId(`switch-to-${TEST_USER_2.username}`)
    ).toBeVisible();
  });

  test("can switch to a linked account and back", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Link second account
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("link-email-input").fill(TEST_USER_2.email);
    await page.getByTestId("link-password-input").fill(TEST_USER_2.password);
    await page.getByTestId("link-account-submit").click();
    await expect(page.getByTestId("link-account-modal")).not.toBeVisible({
      timeout: 10000,
    });

    // Reload to get updated session
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Switch to second account
    await page.getByTestId("account-switcher-button").click();
    await page.getByTestId(`switch-to-${TEST_USER_2.username}`).click();

    // Wait for the page to reload/refresh and verify identity changed
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Go to profile page and verify we're now on the second account
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // The username field should show the second user's username
    const usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveValue(TEST_USER_2.username, {
      timeout: 10000,
    });

    // Now switch back to the first account
    await page.getByTestId("account-switcher-button").click();
    await page.getByTestId(`switch-to-${TEST_USER.username}`).click();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await expect(usernameInput).toHaveValue(TEST_USER.username, {
      timeout: 10000,
    });
  });

  test("can unlink an account from profile settings", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Link second account
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("link-email-input").fill(TEST_USER_2.email);
    await page.getByTestId("link-password-input").fill(TEST_USER_2.password);
    await page.getByTestId("link-account-submit").click();
    await expect(page.getByTestId("link-account-modal")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify linked account appears
    await expect(
      page.getByTestId(`linked-account-${TEST_USER_2.username}`)
    ).toBeVisible({ timeout: 10000 });

    // Click Unlink
    await page.getByTestId(`unlink-${TEST_USER_2.username}`).click();

    // Linked account should disappear
    await expect(
      page.getByTestId(`linked-account-${TEST_USER_2.username}`)
    ).not.toBeVisible({ timeout: 10000 });

    // After reload, account switcher should not be visible (no more linked accounts)
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByTestId("account-switcher-button")
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("prevents linking to own account", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({
      timeout: 5000,
    });

    // Try to link the same account
    await page.getByTestId("link-email-input").fill(TEST_USER.email);
    await page.getByTestId("link-password-input").fill(TEST_USER.password);
    await page.getByTestId("link-account-submit").click();

    await expect(page.getByTestId("link-error")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("link-error")).toContainText(
      "Cannot link to your own account"
    );
  });
});
