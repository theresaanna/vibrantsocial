import { test, expect } from "@playwright/test";
import { setTestUserTier, setTestUserFrame } from "../helpers/db";

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
    test.fixme();
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);

    // Look for the frame button
    const frameButton = page.getByRole("button", { name: /Frame/ });
    await expect(frameButton).toBeVisible({ timeout: 10000 });
    await frameButton.click();

    // Frame selector overlay should appear
    await expect(page.getByTestId("frame-selector-backdrop")).toBeVisible({
      timeout: 5000,
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
    test.fixme();
    await page.goto("/profile");

    const frameButton = page.getByRole("button", { name: /Frame/ });
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
    await expect(page.getByRole("button", { name: /Frame/ })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /Frame/ }).click();

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

  test("free user sees upgrade prompt in frame selector", async ({ page }) => {
    test.fixme();
    await page.goto("/profile");

    const frameButton = page.getByRole("button", { name: /Frame/ });
    await expect(frameButton).toBeVisible({ timeout: 10000 });
    await frameButton.click();

    // Should show upgrade prompt instead of frame options
    await expect(page.getByTestId("frame-upgrade-prompt")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByTestId("frame-option-spring-1")
    ).not.toBeVisible();
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
    test.fixme();
    await page.goto("/e2e_testuser");
    await expect(page).toHaveURL(/\/e2e_testuser/);

    // The frame SVG should be rendered (aria-hidden img inside the avatar area)
    const frameImg = page.locator('img[aria-hidden="true"][src="/frames/neon-1.svg"]');
    await expect(frameImg).toBeVisible({ timeout: 10000 });
  });
});
