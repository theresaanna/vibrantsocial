import { test, expect } from "@playwright/test";
import { setTestUserTier, setTestUserFont, TEST_USER } from "../helpers/db";

/** Navigate to /theme and wait for full hydration */
async function gotoTheme(page: import("@playwright/test").Page) {
  await page.goto("/theme");
  await page.reload();
  await page.waitForLoadState("networkidle");
}

/** Expand the font selector and wait for font options to render */
async function expandFontSelector(page: import("@playwright/test").Page) {
  await expect(async () => {
    await page.getByTestId("font-selector-toggle").click();
    await expect(page.getByTestId("font-option-default")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

test.describe("Username font selector (free tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
    await setTestUserFont(null);
  });

  test.afterEach(async () => {
    await setTestUserFont(null);
  });

  test("font selector section is visible and collapsed by default", async ({ page }) => {
    await gotoTheme(page);

    await expect(page.getByTestId("font-selector")).toBeVisible({ timeout: 10000 });
    expect(await page.getByText("Username Font").count()).toBeGreaterThan(0);

    // Should be collapsed — font options not visible
    await expect(page.getByTestId("font-option-default")).not.toBeVisible();
  });

  test("free user can expand and see free font options", async ({ page }) => {
    await gotoTheme(page);
    await expandFontSelector(page);

    await expect(page.getByTestId("font-option-default")).toBeVisible();
    await expect(page.getByTestId("font-option-sofadi-one")).toBeVisible();
    await expect(page.getByTestId("font-option-jersey-10")).toBeVisible();
  });

  test("free user sees disabled premium font options", async ({ page }) => {
    await gotoTheme(page);
    await expandFontSelector(page);

    await expect(page.getByTestId("font-upgrade-prompt")).toBeVisible({ timeout: 10000 });
    const gugiButton = page.getByTestId("font-option-gugi");
    await expect(gugiButton).toBeVisible();
    await expect(gugiButton).toBeDisabled();
  });

  test("free user can select a free font", async ({ page }) => {
    await gotoTheme(page);
    await expandFontSelector(page);

    const sofadiBtn = page.getByTestId("font-option-sofadi-one");
    await expect(sofadiBtn).toBeVisible({ timeout: 10000 });
    await sofadiBtn.click();

    // The button should now be selected
    await expect(sofadiBtn).toHaveAttribute("aria-pressed", "true");

    // Default should no longer be selected
    await expect(page.getByTestId("font-option-default")).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Username font selector (premium tier)", () => {
  test.beforeEach(async () => {
    await setTestUserTier("premium");
    await setTestUserFont(null);
  });

  test.afterEach(async () => {
    await setTestUserTier("free");
    await setTestUserFont(null);
  });

  test("premium user can see and select premium fonts", async ({ page }) => {
    await gotoTheme(page);
    await expandFontSelector(page);

    const gugiBtn = page.getByTestId("font-option-gugi");
    await expect(gugiBtn).toBeVisible({ timeout: 10000 });
    await expect(gugiBtn).not.toBeDisabled();

    await gugiBtn.click();
    await expect(gugiBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("premium user does not see upgrade prompt for fonts", async ({ page }) => {
    await gotoTheme(page);
    await expandFontSelector(page);

    await expect(page.getByTestId("font-upgrade-prompt")).not.toBeVisible();
  });
});

test.describe("Username font on public profile", () => {
  test.beforeEach(async () => {
    await setTestUserTier("free");
  });

  test.afterEach(async () => {
    await setTestUserFont(null);
  });

  test("public profile shows custom font on display name", async ({ page }) => {
    await setTestUserFont("sofadi-one");

    // Wait briefly for cache invalidation to propagate, then force fresh render
    await page.waitForTimeout(500);
    await page.goto(`/${TEST_USER.username}`);
    await page.reload();

    const displayName = page.getByTestId("profile-display-name");
    await expect(displayName).toBeVisible({ timeout: 10000 });

    // The font is applied on a nested <span> by StyledName component, not the h1 itself
    await page.waitForFunction(() => {
      const span = document.querySelector('[data-testid="profile-display-name"] span[style]');
      return span && (span as HTMLElement).style.fontFamily.includes("Sofadi One");
    }, { timeout: 15000 });

    const fontFamily = await displayName.evaluate(
      (el) => {
        const span = el.querySelector("span[style]");
        return span ? (span as HTMLElement).style.fontFamily : el.style.fontFamily;
      }
    );
    expect(fontFamily).toContain("Sofadi One");
  });

  test("public profile uses default font when no custom font set", async ({ page }) => {
    await setTestUserFont(null);

    await page.goto(`/${TEST_USER.username}`);

    const displayName = page.getByTestId("profile-display-name");
    await expect(displayName).toBeVisible({ timeout: 10000 });

    // No custom font-family style should be applied
    const fontFamily = await displayName.evaluate(
      (el) => el.style.fontFamily
    );
    expect(fontFamily).toBe("");
  });
});
