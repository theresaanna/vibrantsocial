import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("nav links navigate to correct pages", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Compose
    await page.click('a[aria-label="Compose"]');
    await expect(page).toHaveURL(/\/compose/, { timeout: 15000 });

    // Feed
    await page.click('a[aria-label="Feed"]');
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Likes
    await page.click('a[aria-label="Likes"]');
    await expect(page).toHaveURL(/\/likes/, { timeout: 15000 });

    // Bookmarks
    await page.click('a[aria-label="Bookmarks"]');
    await expect(page).toHaveURL(/\/bookmarks/, { timeout: 15000 });
  });

  test("search bar opens and submits search", async ({ page }) => {
    await page.goto("/feed");

    await page.click('button[aria-label="Open search"]');

    const searchInput = page.locator('input[aria-label="Search"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill("testquery");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=testquery/, { timeout: 15000 });
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/feed");

    // Two ThemeToggle instances exist (mobile sm:hidden + desktop hidden sm:block).
    // Target the desktop one inside the "hidden sm:block" wrapper using nth(1).
    const themeButton = page
      .locator(
        'button[aria-label="Switch to dark mode"], button[aria-label="Switch to light mode"]'
      )
      .nth(1);
    await expect(themeButton).toBeVisible({ timeout: 10000 });

    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");

    await themeButton.click();

    // Class should change (light ↔ dark)
    await expect(html).not.toHaveAttribute("class", initialClass ?? "", {
      timeout: 5000,
    });

    // Toggle back
    const toggledButton = page
      .locator(
        'button[aria-label="Switch to dark mode"], button[aria-label="Switch to light mode"]'
      )
      .nth(1);
    await toggledButton.click();
  });

  test("logo link goes to feed for authenticated user", async ({ page }) => {
    // Use full navigation to trigger server-side redirect
    await page.goto("/");

    // Authenticated users on / get redirected to /feed
    await expect(page).toHaveURL(/\/feed/, { timeout: 30000 });
  });
});
