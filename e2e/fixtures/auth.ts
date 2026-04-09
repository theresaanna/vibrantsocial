import { test as base, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

/**
 * Extended test fixture with a forceLogin helper.
 * Use this in tests that may run after storageState has expired.
 */
export const test = base.extend<{ forceLogin: void }>({
  forceLogin: [
    async ({ page }, use) => {
      await page.goto("/feed");
      // Wait for any client-side redirects to settle
      await page.waitForLoadState("networkidle");
      // Check if we ended up on login (server or client redirect)
      if (page.url().includes("/login")) {
        await page.fill('input[name="email"]', TEST_USER.email);
        await page.fill('input[name="password"]', TEST_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/(\/feed|\/complete-profile)/, { timeout: 15000 });
        if (page.url().includes("/complete-profile")) {
          await page.waitForURL("**/feed", { timeout: 30000 });
        }
      }
      // Dismiss cookie toast and auto-tag hint so they don't block UI
      await page.evaluate(() => {
        localStorage.setItem("vibrantsocial-cookie-notice-dismissed", "true");
        localStorage.setItem("autotag-hint-dismissed", "1");
      });
      await use();
    },
    { auto: false },
  ],
});

export { expect };
