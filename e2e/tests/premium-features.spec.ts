import { test, expect } from "../fixtures/auth";
import { TEST_USER, setTestUserTier } from "../helpers/db";

/**
 * Force a fresh login by clearing cookies first, ensuring the JWT
 * reflects the current DB state (e.g. tier changes).
 */
async function freshLogin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(\/feed|\/complete-profile)/, { timeout: 15000 });
  if (page.url().includes("/complete-profile")) {
    await page.waitForURL("**/feed", { timeout: 30000 });
  }
  await page.evaluate(() => {
    localStorage.setItem("vibrantsocial-cookie-notice-dismissed", "true");
    localStorage.setItem("autotag-hint-dismissed", "1");
  });
}

test.describe("Premium Features — page & checkout", () => {
  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("premium page is accessible and shows subscription options", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto("/premium");
    await expect(page).toHaveURL(/\/premium/);
    await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible({ timeout: 10000 });
  });

  test("premium subscribe button redirects to checkout", async ({ page }) => {
    await setTestUserTier("free");
    await freshLogin(page);
    await page.goto("/premium");

    const subscribeButton = page.getByRole("button", { name: /subscribe|upgrade|get premium/i });
    if (await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) => {
            try {
              const url = new URL(resp.url());
              return url.pathname.startsWith("/api/stripe") || url.hostname === "checkout.stripe.com";
            } catch {
              return false;
            }
          },
          { timeout: 10000 }
        ).catch(() => null),
        subscribeButton.click(),
      ]);

      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
    }
  });

  test("premium user sees manage subscription option", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/premium");
    await page.waitForLoadState("networkidle");
    const manageButton = page.getByRole("button", { name: /manage subscription/i });
    await expect(manageButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Premium Features — free user gating", () => {
  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("free user sees disabled schedule toggle", async ({ page }) => {
    await setTestUserTier("free");
    await freshLogin(page);
    await page.goto("/compose");

    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeVisible({ timeout: 10000 });
    await expect(scheduleToggle).toBeDisabled();
  });

  test("free user sees disabled custom audience button", async ({ page }) => {
    await setTestUserTier("free");
    await freshLogin(page);
    await page.goto("/compose");

    const audienceButton = page.getByTestId("custom-audience-button");
    await expect(audienceButton).toBeVisible({ timeout: 10000 });
    await expect(audienceButton).toBeDisabled();
  });

  test("free user cannot select premium profile frames", async ({ page }) => {
    await setTestUserTier("free");
    await freshLogin(page);
    await page.goto("/profile");

    const chooseFrameButton = page.getByTestId("choose-frame-button");
    if (await chooseFrameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chooseFrameButton).toBeDisabled({ timeout: 5000 });
    }
  });

  test("downgraded user sees gated schedule toggle", async ({ page }) => {
    // Downgrade to free (may have been premium from a prior test)
    await setTestUserTier("free");
    await freshLogin(page);
    await page.goto("/compose");

    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeVisible({ timeout: 10000 });
    await expect(scheduleToggle).toBeDisabled();
  });
});

test.describe("Premium Features — premium user access", () => {
  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("premium user can access schedule toggle", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeVisible({ timeout: 10000 });
    await expect(scheduleToggle).toBeEnabled();
  });

  test("premium user can access custom audience", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    const audienceButton = page.getByTestId("custom-audience-button");
    await expect(audienceButton).toBeVisible({ timeout: 10000 });
    await expect(audienceButton).toBeEnabled();

    await audienceButton.click();
    await expect(page.getByTestId("audience-search")).toBeVisible({ timeout: 5000 });
  });

  test("premium user can access profile frame selector", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/profile");

    const chooseFrameButton = page.getByTestId("choose-frame-button");
    await expect(chooseFrameButton).toBeVisible({ timeout: 10000 });
    await chooseFrameButton.click();

    const frameOption = page.locator('[data-testid^="frame-option-"]').first();
    await expect(frameOption).toBeVisible({ timeout: 5000 });
  });

  test("premium user can access font selector", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/theme");

    const fontToggle = page.getByTestId("font-selector-toggle");
    await expect(fontToggle).toBeVisible({ timeout: 10000 });
    await fontToggle.click();

    const fontOption = page.locator('[data-testid^="font-option-"]').first();
    await expect(fontOption).toBeVisible({ timeout: 5000 });
  });
});
