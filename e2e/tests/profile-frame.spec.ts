import { test, expect } from "@playwright/test";
import { setTestUserTier, setTestUserFrame, TEST_USER } from "../helpers/db";

/** Force a fresh login to pick up DB changes (e.g. tier) in the JWT */
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

test.describe("Profile Frame (premium)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
    await setTestUserFrame(null);
  });

  test.afterEach(async () => {
    await setTestUserFrame(null);
    await setTestUserTier("free");
  });

  test("premium user opens frame selector and sees frame options", async ({
    page,
  }) => {
    await freshLogin(page);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Look for the frame button (text is "Add Frame" when no frame set)
    const frameButton = page.getByTestId("choose-frame-button");
    await expect(frameButton).toBeVisible({ timeout: 10000 });
    await frameButton.click();

    // Frame selector overlay should appear
    await expect(page.getByTestId("frame-selector-backdrop")).toBeVisible({
      timeout: 10000,
    });

    // Should show live preview
    await expect(page.getByTestId("frame-preview")).toBeVisible();

    // Should show frame options
    await expect(page.getByTestId("frame-option-spring-1")).toBeVisible();
    await expect(page.getByTestId("frame-option-neon-1")).toBeVisible();
    await expect(page.getByTestId("frame-option-none")).toBeVisible();
  });

  test("selecting a frame shows preview and persists after reload", async ({
    page,
  }) => {
    await freshLogin(page);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const frameButton = page.getByTestId("choose-frame-button");
    await expect(frameButton).toBeVisible({ timeout: 10000 });
    await frameButton.click();

    // Select a spring frame
    await page.getByTestId("frame-option-spring-1").click();

    // Close the selector
    await page.getByTestId("frame-selector-close").click();
    await expect(
      page.getByTestId("frame-selector-backdrop")
    ).not.toBeVisible();

    // Wait for autosave to complete
    await page.waitForTimeout(2000);

    // Reload and reopen to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("choose-frame-button")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("choose-frame-button").click();

    // The spring-1 option should be selected (aria-pressed="true")
    await expect(page.getByTestId("frame-option-spring-1")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

test.describe("Profile Frame gating (free tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
    await setTestUserFrame(null);
  });

  test("free user sees disabled frame button", async ({ page }) => {
    await freshLogin(page);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const frameButton = page.getByTestId("choose-frame-button");
    await expect(frameButton).toBeVisible({ timeout: 10000 });
    // Free users cannot open the frame selector — button is disabled
    await expect(frameButton).toBeDisabled();
  });
});

test.describe("Profile Frame display", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
    await setTestUserFrame("neon-1");
  });

  test.afterEach(async () => {
    await setTestUserFrame(null);
    await setTestUserTier("free");
  });

  test("frame appears on public profile page", async ({ page }) => {
    await freshLogin(page);
    await page.goto(`/${TEST_USER.username}`);
    await expect(page).toHaveURL(/\/e2e_testuser/);

    // The frame image should be rendered on the main profile avatar (largest one)
    const frameImg = page.locator('img[aria-hidden="true"][src*="neon-1"]').first();
    await expect(frameImg).toBeVisible({ timeout: 10000 });
  });
});
