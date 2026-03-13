import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

test.describe("Friends List & Following Privacy", () => {
  test("own profile shows friends count and link", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}`);

    // Wait for profile to load
    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    // Friends count should be visible on own profile
    await expect(page.locator("text=/\\d+ friends/")).toBeVisible({
      timeout: 5000,
    });
  });

  test("own profile shows following count", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    // Following count should be visible on own profile
    await expect(page.locator("text=/\\d+ following/")).toBeVisible({
      timeout: 5000,
    });
  });

  test("friends page loads for own profile", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/friends`);

    // Should show the friends list header
    await expect(
      page.locator("h1", { hasText: `@${TEST_USER.username}'s Friends` })
    ).toBeVisible({ timeout: 15000 });
  });

  test("following page loads for own profile", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/following`);

    // Should show the following list header
    await expect(
      page.locator("h1", { hasText: `@${TEST_USER.username} is Following` })
    ).toBeVisible({ timeout: 15000 });
  });
});
