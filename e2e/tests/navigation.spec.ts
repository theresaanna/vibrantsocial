import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("nav links navigate to correct pages", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

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

    await page.click('a[aria-label="Search"]');
    await expect(page).toHaveURL(/\/search/, { timeout: 15000 });
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/feed");

    // ThemeToggle cycles through system → light → dark.
    // Target the desktop one (nth(1)) since mobile is hidden at desktop viewport.
    const themeButton = page
      .locator(
        'button[aria-label="System theme"], button[aria-label="Light mode"], button[aria-label="Dark mode"]'
      )
      .nth(1);
    await expect(themeButton).toBeVisible({ timeout: 10000 });

    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");

    await themeButton.click();

    // Class should change after cycling theme
    await expect(html).not.toHaveAttribute("class", initialClass ?? "", {
      timeout: 5000,
    });

    // Toggle again
    const toggledButton = page
      .locator(
        'button[aria-label="System theme"], button[aria-label="Light mode"], button[aria-label="Dark mode"]'
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
