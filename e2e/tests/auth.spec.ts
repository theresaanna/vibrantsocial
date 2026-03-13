import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

const AUTH_STATE_PATH = "e2e/auth/user.json";

test.describe("Authentication", () => {
  test("login with credentials and save auth state", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Login redirects to /complete-profile, which redirects to /feed
    // if the profile is already complete
    await page.waitForURL("**/feed", { timeout: 15000 });
    await expect(page).toHaveURL(/\/feed/);

    // Save auth state for all other test suites
    await page.context().storageState({ path: AUTH_STATE_PATH });
  });

  test("unauthenticated user is redirected to login", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/compose");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test("invalid credentials show error message", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page.fill('input[name="email"]', "wrong@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(
      page.locator("text=Invalid email or password")
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });
});
