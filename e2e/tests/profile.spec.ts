import { test, expect } from "@playwright/test";
import { setTestUserTier } from "../helpers/db";

test.describe("Profile Settings", () => {
  test("profile settings page loads with editable fields", async ({
    page,
  }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);

    // Key form fields should be visible
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(
      page.locator('input[name="displayName"]')
    ).toBeVisible();
  });
});

test.describe("Theme editor (premium)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
  });

  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("profile theme editor shows preset buttons", async ({ page }) => {
    await page.goto("/profile");

    // Scroll to the bottom to reveal the theme editor (avoids DOM detach from Lexical re-renders)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Preset buttons have aria-pressed attribute — use that to distinguish from editor toolbar
    await expect(
      page.locator("button[aria-pressed]", { hasText: "default" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("button[aria-pressed]", { hasText: "ocean" })
    ).toBeVisible();
  });

  test("clicking a theme preset updates color pickers", async ({
    page,
  }) => {
    await page.goto("/profile");

    // Scroll to the bottom to reveal theme section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Get initial background color value from the color input
    const bgColorInput = page.locator('input[aria-label="Background"]');
    await expect(bgColorInput).toBeVisible({ timeout: 10000 });
    const initialColor = await bgColorInput.inputValue();

    // Click the "Ocean" preset (use aria-pressed to target theme presets)
    await page
      .locator("button[aria-pressed]", { hasText: "ocean" })
      .click();

    // The background color should have changed
    await expect(bgColorInput).not.toHaveValue(initialColor, {
      timeout: 3000,
    });
  });

  test("theme preview modal opens and closes", async ({ page }) => {
    await page.goto("/profile");

    // Scroll to the bottom to reveal preview button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const previewButton = page.getByRole("button", {
      name: /Preview Light/,
    });
    await expect(previewButton).toBeVisible({ timeout: 10000 });
    await previewButton.click();

    // Preview modal should appear with "Theme Preview" header
    await expect(page.locator("text=Theme Preview")).toBeVisible({
      timeout: 5000,
    });

    // Light and Dark toggle buttons should be visible in the modal
    await expect(
      page.locator(".fixed >> button:has-text('Light')")
    ).toBeVisible();
    await expect(
      page.locator(".fixed >> button:has-text('Dark')")
    ).toBeVisible();

    // Close the modal
    await page.locator(".fixed >> button:has-text('Close')").click();

    // Modal should be gone
    await expect(page.locator("text=Theme Preview")).not.toBeVisible();
  });
});

test.describe("Theme editor gating (free tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
  });

  test("free user sees upgrade prompt instead of theme editor", async ({
    page,
  }) => {
    await page.goto("/profile");

    // Scroll to bottom to ensure the section is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Upgrade prompt should be visible
    await expect(
      page.getByTestId("theme-upgrade-prompt")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/profile themes are a premium feature/i)
    ).toBeVisible();
  });

  test("free user does not see color pickers or presets", async ({
    page,
  }) => {
    await page.goto("/profile");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Theme preset buttons should not exist
    await expect(
      page.locator("button[aria-pressed]", { hasText: "default" })
    ).not.toBeVisible();

    // Color picker inputs should not exist
    await expect(
      page.locator('input[aria-label="Background"]')
    ).not.toBeVisible();
  });
});
