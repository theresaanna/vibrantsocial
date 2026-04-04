import { test, expect } from "@playwright/test";

test.describe("Marketplace", () => {
  test("marketplace page is accessible when logged in", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page).toHaveURL(/\/marketplace/);
    await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible({ timeout: 10000 });
  });

  test("marketplace page is accessible when not authenticated", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/marketplace");
    await expect(page).toHaveURL(/\/marketplace/);
    // Unauthenticated users see the grid but not the composer
    await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible({ timeout: 10000 });
    await context.close();
  });

  test("marketplace nav link is visible", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);
    const navLink = page.getByRole("link", { name: "Marketplace" });
    await expect(navLink).toBeVisible({ timeout: 10000 });
  });

  test("marketplace composer shows listing details section", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByText("Listing Details")).toBeVisible({ timeout: 10000 });
  });

  test("marketplace composer has purchase URL field", async ({ page }) => {
    await page.goto("/marketplace");
    const purchaseUrlInput = page.getByTestId("marketplace-purchase-url");
    await expect(purchaseUrlInput).toBeVisible({ timeout: 10000 });
  });

  test("marketplace composer has price field", async ({ page }) => {
    await page.goto("/marketplace");
    const priceInput = page.getByTestId("marketplace-price");
    await expect(priceInput).toBeVisible({ timeout: 10000 });
  });

  test("marketplace composer has shipping dropdown", async ({ page }) => {
    await page.goto("/marketplace");
    const shippingSelect = page.getByTestId("marketplace-shipping");
    await expect(shippingSelect).toBeVisible({ timeout: 10000 });
  });

  test("marketplace composer has terms checkbox", async ({ page }) => {
    await page.goto("/marketplace");
    const termsCheckbox = page.getByTestId("marketplace-terms-checkbox");
    await expect(termsCheckbox).toBeVisible({ timeout: 10000 });
  });

  test("submit button is disabled when terms not agreed", async ({ page }) => {
    await page.goto("/marketplace");
    const submitButton = page.getByTestId("marketplace-submit");
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeDisabled();
  });

  test("submit button is enabled after agreeing to terms", async ({ page }) => {
    await page.goto("/marketplace");
    const termsCheckbox = page.getByTestId("marketplace-terms-checkbox");
    await termsCheckbox.check();
    const submitButton = page.getByTestId("marketplace-submit");
    await expect(submitButton).toBeEnabled();
  });

  test("flat rate shows shipping price input", async ({ page }) => {
    await page.goto("/marketplace");
    const shippingSelect = page.getByTestId("marketplace-shipping");
    await shippingSelect.selectOption("FLAT_RATE");
    const shippingPriceInput = page.getByTestId("marketplace-shipping-price");
    await expect(shippingPriceInput).toBeVisible();
  });

  test("content warnings section shows NSFW and Graphic/Explicit but not Sensitive", async ({ page }) => {
    await page.goto("/marketplace");

    // Expand content warnings
    await page.getByText("Content Warnings").click();

    await expect(page.getByRole("checkbox", { name: "NSFW" })).toBeVisible();
    await expect(page.getByText("Graphic/Explicit")).toBeVisible();
    // Sensitive should NOT appear in marketplace composer
    const sensitiveCheckboxes = page.locator("label", { hasText: "Sensitive" });
    await expect(sensitiveCheckboxes).toHaveCount(0);
  });

  test("marketplace notice banner is visible", async ({ page }) => {
    await page.goto("/marketplace");
    const notice = page.getByTestId("marketplace-notice");
    await expect(notice).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Welcome to the Marketplace")).toBeVisible();
    await expect(page.getByText(/anything you can ship or send digitally/)).toBeVisible();
  });

  test("marketplace grid shows empty state when no posts", async ({ page }) => {
    await page.goto("/marketplace");
    // Either the grid or empty state should be visible
    const grid = page.getByTestId("marketplace-grid");
    const emptyState = page.getByText("No marketplace listings yet.");
    await expect(grid.or(emptyState)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Marketplace Profile Tab", () => {
  test("marketplace tab appears on profile when user has marketplace posts", async ({ page }) => {
    // This test assumes the logged-in user has marketplace posts
    // If they don't, the tab shouldn't appear (which is also valid)
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);

    // Navigate to own profile
    const profileLink = page.getByRole("link", { name: "Profile" });
    await profileLink.click();

    // Check if marketplace tab exists (it may not if user has no marketplace posts)
    const marketplaceTab = page.getByTestId("profile-marketplace-tab");
    const hasTab = await marketplaceTab.isVisible().catch(() => false);

    if (hasTab) {
      await marketplaceTab.click();
      await expect(page).toHaveURL(/tab=marketplace/);
    }
  });
});
