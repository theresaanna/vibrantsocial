import { test, expect } from "@playwright/test";
import { setTestUserTier } from "../helpers/db";

/** Navigate to /theme and wait for hydration */
async function gotoTheme(page: import("@playwright/test").Page) {
  await page.goto("/theme");
  await page.reload();
  await page.waitForLoadState("networkidle");
}

/** Expand the collapsible Theme section with retry for hydration timing */
async function expandThemeSection(page: import("@playwright/test").Page) {
  const themeToggle = page.locator('button:has-text("Theme")').first();
  await expect(themeToggle).toBeVisible({ timeout: 10000 });

  await expect(async () => {
    const expanded = await themeToggle.getAttribute("aria-expanded");
    if (expanded === "false") {
      await themeToggle.click();
    }
    await expect(
      page.locator("button[aria-pressed]", { hasText: "default" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

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

  test("theme editor shows preset buttons", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    await expect(
      page.locator("button[aria-pressed]", { hasText: "ocean" })
    ).toBeVisible();
  });

  test("clicking a theme preset updates selection", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    // Click the "ocean" preset
    const oceanButton = page.locator("button[aria-pressed]", { hasText: "ocean" });
    await expect(oceanButton).toBeVisible({ timeout: 10000 });
    await oceanButton.click();

    // The ocean preset should now be active (aria-pressed="true")
    await expect(oceanButton).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("AI theme generation (premium)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
  });

  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("AI theme generator section is visible for premium users", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    // Scroll to see AI section
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);

    await expect(page.getByTestId("ai-theme-generator")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("ai-generate-button")).toBeVisible();
  });
});

test.describe("Theme editor gating (free tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
  });

  test("free user sees preset theme buttons", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    await expect(
      page.locator("button[aria-pressed]", { hasText: "ocean" })
    ).toBeVisible();
  });

  test("free user sees AI theme upgrade prompt", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);

    // Free users should see an upgrade prompt instead of the AI generator
    await expect(
      page.getByTestId("ai-theme-upgrade-prompt")
    ).toBeVisible({ timeout: 5000 });
  });
});
