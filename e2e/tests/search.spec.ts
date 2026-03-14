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

  test("search via header search bar navigates to search page", async ({
    page,
  }) => {
    await page.goto("/feed");

    // Open search dropdown
    await page.click('button[aria-label="Open search"]');

    const searchInput = page.locator('input[aria-label="Search"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill(TEST_USER.username);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(
      new RegExp(`/search\\?q=${TEST_USER.username}`)
    );

    // Should find the test user in results
    await expect(
      page.getByText(`@${TEST_USER.username}`, { exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("search with short query does not trigger search", async ({
    page,
  }) => {
    await page.goto("/feed");

    await page.click('button[aria-label="Open search"]');

    const searchInput = page.locator('input[aria-label="Search"]');
    await searchInput.fill("a");
    await page.keyboard.press("Enter");

    // Should stay on the current page — query < 2 chars doesn't submit
    await expect(page).toHaveURL(/\/feed/);
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
