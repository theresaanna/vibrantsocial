import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

test.describe("Search", () => {
  test("search for users by username", async ({ page }) => {
    await page.goto(`/search?q=${TEST_USER.username}`);

    // The Users tab should be active by default and show results
    await expect(
      page.getByText(`@${TEST_USER.username}`, { exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("search nav link navigates to search page", async ({
    page,
  }) => {
    test.fixme();
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Click the Search nav link
    await page.click('a[aria-label="Search"]');

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

  test("search page has users and posts tabs", async ({ page }) => {
    await page.goto(`/search?q=test`);

    // Both tab buttons should be visible in the search results area
    await expect(
      page.locator("main").getByRole("button", { name: "Users" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("main").getByRole("button", { name: "Posts" })
    ).toBeVisible();
  });
});
