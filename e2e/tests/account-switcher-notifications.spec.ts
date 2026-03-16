import { test, expect } from "../fixtures/auth";
import {
  TEST_USER,
  TEST_USER_2,
  cleanupLinkedAccountGroups,
  cleanupTestNotifications,
  linkTestAccounts,
  createTestNotifications,
} from "../helpers/db";

test.describe("Account Switcher Notification Counts", () => {
  test.beforeEach(async () => {
    await cleanupTestNotifications();
    await cleanupLinkedAccountGroups();
  });

  test.afterAll(async () => {
    await cleanupTestNotifications();
    await cleanupLinkedAccountGroups();
  });

  test("shows notification badge on account switcher when linked account has unread notifications", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;

    // Link accounts and create notifications for the second user
    await linkTestAccounts();
    await createTestNotifications(TEST_USER_2.email, TEST_USER.email, 3);

    // Reload to pick up linked accounts
    await page.reload();
    await page.waitForLoadState("networkidle");

    // The account switcher should show a badge with the count
    const switcherButton = page.locator(
      '[data-testid="account-switcher-button"]:visible'
    );
    await expect(switcherButton).toBeVisible({ timeout: 10000 });

    const badge = page.locator(
      '[data-testid="account-switcher-total-badge"]:visible'
    );
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText("3");
  });

  test("does not show notification badge when linked accounts have no unread notifications", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;

    // Link accounts but don't create any notifications
    await linkTestAccounts();

    await page.reload();
    await page.waitForLoadState("networkidle");

    const switcherButton = page.locator(
      '[data-testid="account-switcher-button"]:visible'
    );
    await expect(switcherButton).toBeVisible({ timeout: 10000 });

    // Badge should not appear
    await expect(
      page.locator('[data-testid="account-switcher-total-badge"]')
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("shows per-account notification count in the dropdown", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;

    // Link accounts and create notifications
    await linkTestAccounts();
    await createTestNotifications(TEST_USER_2.email, TEST_USER.email, 5);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Open the account switcher dropdown
    const switcherButton = page.locator(
      '[data-testid="account-switcher-button"]:visible'
    );
    await switcherButton.click();
    await expect(
      page.getByTestId("account-switcher-dropdown")
    ).toBeVisible({ timeout: 5000 });

    // The linked account row should show the notification count
    const accountRow = page.getByTestId(`switch-to-${TEST_USER_2.username}`);
    await expect(accountRow).toBeVisible();
    const badge = accountRow.locator('[data-testid="notification-count"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("5");
  });

  test("notification count updates after switching accounts and back", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;

    // Link accounts and create notifications for user 2
    await linkTestAccounts();
    await createTestNotifications(TEST_USER_2.email, TEST_USER.email, 2);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify badge shows count for user 2
    const badge = page.locator(
      '[data-testid="account-switcher-total-badge"]:visible'
    );
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText("2");

    // Switch to user 2
    await page.locator('[data-testid="account-switcher-button"]:visible').click();
    await page.getByTestId(`switch-to-${TEST_USER_2.username}`).click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Now user 2 is active, badge should NOT show count for user 2 anymore
    // (user 1 has 0 notifications, so badge should not be visible)
    await expect(
      page.locator('[data-testid="account-switcher-total-badge"]')
    ).not.toBeVisible({ timeout: 5000 });
  });
});
