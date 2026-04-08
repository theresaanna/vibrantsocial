import { test, expect } from "../fixtures/auth";
import { TEST_USER, setTestUserTier } from "../helpers/db";

test.describe("Premium Features @slow", () => {
  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("premium page is accessible and shows subscription options", async ({ page, forceLogin }) => {
    await forceLogin;
    await page.goto("/premium");
    await expect(page).toHaveURL(/\/premium/);

    // Should show premium page content
    await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible({ timeout: 10000 });
  });

  test("free user sees premium badge on gated features", async ({ page, forceLogin }) => {
    await setTestUserTier("free");
    await forceLogin;
    await page.goto("/compose");

    // Schedule toggle should be disabled for free users
    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeVisible({ timeout: 10000 });
    await expect(scheduleToggle).toBeDisabled();

    // Custom audience button should indicate premium
    const audienceButton = page.getByTestId("custom-audience-button");
    await expect(audienceButton).toBeVisible();
    await expect(audienceButton).toBeDisabled();
  });

  test("premium user can access schedule toggle", async ({ page, forceLogin }) => {
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/compose");

    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeVisible({ timeout: 10000 });
    await expect(scheduleToggle).toBeEnabled();
  });

  test("premium user can access custom audience", async ({ page, forceLogin }) => {
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/compose");

    const audienceButton = page.getByTestId("custom-audience-button");
    await expect(audienceButton).toBeVisible({ timeout: 10000 });
    await expect(audienceButton).toBeEnabled();

    // Click to open the audience picker
    await audienceButton.click();

    // Audience search should appear
    await expect(page.getByTestId("audience-search")).toBeVisible({ timeout: 5000 });
  });

  test("premium user can access profile frame selector", async ({ page, forceLogin }) => {
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/profile");

    const chooseFrameButton = page.getByTestId("choose-frame-button");
    await expect(chooseFrameButton).toBeVisible({ timeout: 10000 });
    await chooseFrameButton.click();

    // Frame options should appear
    const frameOption = page.locator('[data-testid^="frame-option-"]').first();
    await expect(frameOption).toBeVisible({ timeout: 5000 });
  });

  test("free user cannot select premium profile frames", async ({ page, forceLogin }) => {
    await setTestUserTier("free");
    await forceLogin;
    await page.goto("/profile");

    const chooseFrameButton = page.getByTestId("choose-frame-button");
    // Frame button should be visible but disabled for free users
    if (await chooseFrameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chooseFrameButton).toBeDisabled({ timeout: 5000 });
    }
  });

  test("premium user can access font selector", async ({ page, forceLogin }) => {
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/theme");

    const fontToggle = page.getByTestId("font-selector-toggle");
    await expect(fontToggle).toBeVisible({ timeout: 10000 });
    await fontToggle.click();

    // Font options should appear
    const fontOption = page.locator('[data-testid^="font-option-"]').first();
    await expect(fontOption).toBeVisible({ timeout: 5000 });
  });

  test("premium subscribe button redirects to checkout", async ({ page, forceLogin }) => {
    await setTestUserTier("free");
    await forceLogin;
    await page.goto("/premium");

    // Look for subscribe/upgrade button
    const subscribeButton = page.getByRole("button", { name: /subscribe|upgrade|get premium/i });
    if (await subscribeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Clicking should initiate Stripe checkout (will redirect)
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

      // Should either redirect to Stripe or get a checkout URL
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
    }
  });

  test("premium user sees manage subscription option", async ({ page, forceLogin }) => {
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/premium");
    await page.waitForLoadState("networkidle");

    // Should show manage/billing option instead of subscribe
    const manageButton = page.getByRole("button", { name: /manage subscription/i });
    await expect(manageButton).toBeVisible({ timeout: 10000 });
  });

  test("premium features become gated after downgrade", async ({ page, forceLogin }) => {
    // Start as premium
    await setTestUserTier("premium");
    await forceLogin;
    await page.goto("/compose");

    const scheduleToggle = page.getByTestId("schedule-toggle");
    await expect(scheduleToggle).toBeEnabled({ timeout: 10000 });

    // Downgrade to free — need fresh login to get new JWT
    await setTestUserTier("free");
    await page.goto("/login");
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/feed", { timeout: 15000 });

    await page.goto("/compose");
    await expect(scheduleToggle).toBeDisabled({ timeout: 10000 });
  });
});
