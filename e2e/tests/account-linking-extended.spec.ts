import { test, expect } from "../fixtures/auth";
import {
  TEST_USER,
  TEST_USER_2,
  seedTestUser,
  seedSecondTestUser,
  cleanupLinkedAccountGroups,
  linkTestAccounts,
  createTestNotifications,
  cleanupTestNotifications,
} from "../helpers/db";

test.describe("Account Linking Extended @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await cleanupLinkedAccountGroups();
    await cleanupTestNotifications();
  });

  test.afterAll(async () => {
    await cleanupLinkedAccountGroups();
    await cleanupTestNotifications();
  });

  // --- OAuth Link Buttons ---

  test("link modal shows OAuth provider buttons", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({ timeout: 5000 });

    // Should see Google and Discord OAuth buttons
    await expect(page.getByTestId("link-google-button")).toBeVisible();
    await expect(page.getByTestId("link-discord-button")).toBeVisible();
  });

  // --- Account Switcher Dropdown ---

  test("account switcher dropdown shows add account button", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinkedAccountGroups();
    await linkTestAccounts();

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Reload to pick up linked accounts in session
    await page.reload();
    await page.waitForLoadState("networkidle");

    const switcherButton = page.locator('[data-testid="account-switcher-button"]:visible');
    await expect(switcherButton).toBeVisible({ timeout: 10000 });
    await switcherButton.click();

    const dropdown = page.getByTestId("account-switcher-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Should have "Add another account" option
    await expect(page.getByTestId("add-account-button")).toBeVisible();
  });

  // --- Notification Counts on Linked Accounts ---

  test("account switcher shows notification counts for linked accounts", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;
    await cleanupLinkedAccountGroups();
    await linkTestAccounts();

    // Create notifications for the second test user
    await createTestNotifications(TEST_USER_2.email, TEST_USER.email, 2);

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");

    const switcherButton = page.locator('[data-testid="account-switcher-button"]:visible');
    await expect(switcherButton).toBeVisible({ timeout: 10000 });

    // Total badge should show a count
    const totalBadge = page.getByTestId("account-switcher-total-badge");
    await expect(totalBadge).toBeVisible({ timeout: 10000 });

    // Open dropdown
    await switcherButton.click();

    // Per-account notification count should be visible
    const notifCount = page.getByTestId("notification-count").first();
    await expect(notifCount).toBeVisible({ timeout: 10000 });
  });

  // --- Prevent Duplicate Linking ---

  test("cannot link same account twice", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinkedAccountGroups();
    await linkTestAccounts();

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Account should already be linked
    await expect(
      page.getByTestId(`linked-account-${TEST_USER_2.username}`)
    ).toBeVisible({ timeout: 10000 });

    // Try linking again
    await page.getByTestId("link-account-button").click();
    await expect(page.getByTestId("link-account-modal")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("link-email-input").fill(TEST_USER_2.email);
    await page.getByTestId("link-password-input").fill(TEST_USER_2.password);
    await page.getByTestId("link-account-submit").click();

    // Should show an error about already linked
    await expect(page.getByTestId("link-error")).toBeVisible({ timeout: 10000 });
  });

  // --- Unlink and Verify Switcher Disappears ---

  test("unlinking last account removes switcher from all pages", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinkedAccountGroups();
    await linkTestAccounts();

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Unlink
    await page.getByTestId(`unlink-${TEST_USER_2.username}`).click();
    await expect(
      page.getByTestId(`linked-account-${TEST_USER_2.username}`)
    ).not.toBeVisible({ timeout: 10000 });

    // Navigate to feed
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    // Switcher should not be visible
    await expect(
      page.locator('[data-testid="account-switcher-button"]').first()
    ).not.toBeVisible({ timeout: 5000 });
  });
});
