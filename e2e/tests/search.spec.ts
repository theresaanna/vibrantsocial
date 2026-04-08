import { test, expect } from "../fixtures/auth";
import { TEST_USER } from "../helpers/db";

test.describe("Search", () => {
  test("search for users by username", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto(`/search?q=${TEST_USER.username}`);

    // The Users tab should be active by default and show results
    await expect(
      page.getByText(`@${TEST_USER.username}`, { exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("search nav link navigates to search page", async ({
    page,
    forceLogin,
  }) => {
    await forceLogin;

    // Wait for nav to be interactive, then click Search link
    await page.waitForSelector('a[href="/search"]', { state: "visible", timeout: 15000 });
    await page.click('a[href="/search"]');

    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });

    // The search input on the search page should be visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a query and search
    await searchInput.fill(TEST_USER.username);
    await page.waitForTimeout(500); // Wait for debounce

    // Should find the test user in results
    await expect(
      page.getByText(`@${TEST_USER.username}`, { exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("search page has users and posts tabs", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto(`/search?q=test`);

    // Both tab buttons should be visible in the search results area
    await expect(
      page.getByRole("button", { name: "Users" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Posts" })
    ).toBeVisible();
  });
});
