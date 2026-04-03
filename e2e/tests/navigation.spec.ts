import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("nav links navigate to correct pages", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Wait for nav to be interactive
    await page.waitForSelector('a[aria-label="Home"]', { state: "visible", timeout: 15000 });

    // Compose
    await page.click('a[aria-label="Compose"]');
    await expect(page).toHaveURL(/\/compose/, { timeout: 15000 });

    // Home (Feed)
    await page.click('a[aria-label="Home"]');
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Likes
    await page.click('a[aria-label="Likes"]');
    await expect(page).toHaveURL(/\/likes/, { timeout: 15000 });

    // Bookmarks
    await page.click('a[aria-label="Bookmarks"]');
    await expect(page).toHaveURL(/\/bookmarks/, { timeout: 15000 });
  });

  test("search nav link navigates to /search", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    await page.waitForSelector('a[aria-label="Search"]', { state: "visible", timeout: 15000 });
    await page.click('a[aria-label="Search"]');
    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/feed");

    // ThemeToggle cycles through system → light → dark.
    const themeSelector =
      'button[aria-label="System theme"], button[aria-label="Light mode"], button[aria-label="Dark mode"]';
    const themeButton = page.locator(themeSelector).first();
    await expect(themeButton).toBeVisible({ timeout: 10000 });

    // Get the initial label
    const initialLabel = await themeButton.getAttribute("aria-label");

    // Click to cycle the theme
    await themeButton.click();

    // The button's aria-label should change after cycling
    const nextButton = page.locator(themeSelector).first();
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    const nextLabel = await nextButton.getAttribute("aria-label");
    expect(nextLabel).not.toBe(initialLabel);

    // Click again to cycle to the next state
    await nextButton.click();
    const thirdButton = page.locator(themeSelector).first();
    await expect(thirdButton).toBeVisible({ timeout: 5000 });
    const thirdLabel = await thirdButton.getAttribute("aria-label");
    expect(thirdLabel).not.toBe(nextLabel);
  });

  test("logo link goes to feed for authenticated user", async ({ page }) => {
    // Use full navigation to trigger server-side redirect
    await page.goto("/");

    // Authenticated users on / get redirected to /feed
    await expect(page).toHaveURL(/\/feed/, { timeout: 30000 });
  });
});
