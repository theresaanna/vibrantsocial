import { test, expect } from "@playwright/test";
import { setTestUserTier, TEST_USER } from "../helpers/db";

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
    // Wait for the theme preview (inline preview is always rendered when expanded)
    await expect(
      page.locator('[data-testid="ai-theme-generator"], [data-testid="ai-theme-upgrade-prompt"]')
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

  test("theme editor expands and shows color preview", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    // The inline preview section should be visible
    await expect(
      page.locator('input[name="profileBgColor"]')
    ).toBeAttached();
  });

  test("theme editor renders hidden color inputs", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    // All 5 color hidden inputs should be present
    await expect(page.locator('input[name="profileBgColor"]')).toBeAttached();
    await expect(page.locator('input[name="profileTextColor"]')).toBeAttached();
    await expect(page.locator('input[name="profileLinkColor"]')).toBeAttached();
    await expect(page.locator('input[name="profileSecondaryColor"]')).toBeAttached();
    await expect(page.locator('input[name="profileContainerColor"]')).toBeAttached();
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
    await freshLogin(page);
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

  test("free user sees theme editor with color inputs", async ({ page }) => {
    await gotoTheme(page);
    await expandThemeSection(page);

    // Free users should still see the theme editor with color inputs
    await expect(
      page.locator('input[name="profileBgColor"]')
    ).toBeAttached();
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
