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
    test.fixme();
    await page.goto("/profile");

    // Wait for profile page to load, then scroll theme editor into view
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 10000 });
    // Scroll to bottom multiple times to ensure lazy-rendered content loads
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
    }

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
    test.fixme();
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
    test.fixme();
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

test.describe("AI theme generation (premium)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
  });

  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("AI prompt input is visible for premium users", async ({ page }) => {
    test.fixme();
    await page.goto("/profile");

    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });
    // Expand theme editor
    await page.getByRole("button", { name: /profile theme/i }).click();

    // Scroll to see AI section
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);

    await expect(page.getByTestId("ai-prompt-input")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("ai-generate-button")).toBeVisible();
  });

  test("generates a theme, saves as preset, and selects it", async ({
    page,
  }) => {
    test.fixme();
    await page.goto("/profile");

    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /profile theme/i }).click();

    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);

    // Type a prompt and generate
    const promptInput = page.getByTestId("ai-prompt-input");
    await promptInput.fill("warm autumn forest");
    await page.getByTestId("ai-generate-button").click();

    // Wait for generation to complete — save form should appear
    await expect(page.getByTestId("save-preset-form")).toBeVisible({
      timeout: 30000,
    });

    // Verify preset name was pre-filled
    const nameInput = page.getByTestId("preset-name-input");
    await expect(nameInput).not.toHaveValue("");

    // Save the preset
    await page.getByTestId("save-preset-button").click();

    // Wait for the custom preset pill to appear
    const presetName = await nameInput.inputValue();
    const customPresetButton = page.getByTestId(
      `custom-preset-${presetName}`
    );
    await expect(customPresetButton).toBeVisible({ timeout: 5000 });

    // Click the custom preset to select it
    await customPresetButton.click();
    await expect(customPresetButton).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Delete the custom preset
    const deleteButton = page.getByTestId(`delete-preset-${presetName}`);
    await deleteButton.click();
    await expect(customPresetButton).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("Theme editor gating (free tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
  });

  test("free user sees preset theme buttons", async ({ page }) => {
    test.fixme();
    await page.goto("/profile");

    // Scroll to bottom to ensure the section is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Preset buttons should be visible for free users
    await expect(
      page.locator("button[aria-pressed]", { hasText: "default" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("button[aria-pressed]", { hasText: "ocean" })
    ).toBeVisible();
  });

  test("free user sees disabled AI theme generator", async ({ page }) => {
    test.fixme();
    await page.goto("/profile");

    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(500);

    // AI prompt should be disabled
    await expect(page.getByTestId("ai-prompt-input")).toBeDisabled();
    await expect(page.getByTestId("ai-generate-button")).toBeDisabled();
  });

  test("free user does not see custom color pickers", async ({ page }) => {
    test.fixme();
    await page.goto("/profile");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Custom color picker inputs should not exist for free users
    await expect(
      page.locator('input[aria-label="Background"]')
    ).not.toBeVisible();

    // Upgrade prompt for custom colors should be visible
    await expect(
      page.getByTestId("custom-colors-upgrade-prompt")
    ).toBeVisible();
  });
});
