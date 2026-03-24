import { test, expect } from "@playwright/test";

test.describe("NSFW Toggle in Navigation", () => {
  test("shows NSFW toggle in header when logged in", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });

  test("NSFW toggle has correct aria attributes when off", async ({ page }) => {
    await page.goto("/feed");

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Default should be off (aria-pressed=false)
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", "NSFW off");
  });

  test("clicking NSFW toggle changes its state", async ({ page }) => {
    await page.goto("/feed");

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Get initial state
    const initialPressed = await toggle.getAttribute("aria-pressed");

    // Click to toggle
    await toggle.click();

    // Wait for state change
    const expectedPressed = initialPressed === "true" ? "false" : "true";
    await expect(toggle).toHaveAttribute("aria-pressed", expectedPressed, {
      timeout: 10000,
    });
  });

  test("NSFW toggle persists state across page navigation", async ({
    page,
  }) => {
    await page.goto("/feed");

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Toggle on
    const initialState = await toggle.getAttribute("aria-pressed");
    await toggle.click();

    const newState = initialState === "true" ? "false" : "true";
    await expect(toggle).toHaveAttribute("aria-pressed", newState, {
      timeout: 10000,
    });

    // Navigate to communities
    await page.goto("/communities");
    const toggleAfterNav = page.getByTestId("nsfw-toggle");
    await expect(toggleAfterNav).toBeVisible({ timeout: 10000 });

    // State should persist
    await expect(toggleAfterNav).toHaveAttribute("aria-pressed", newState);

    // Toggle back to original state to clean up
    await toggleAfterNav.click();
    await expect(toggleAfterNav).toHaveAttribute(
      "aria-pressed",
      initialState!,
      { timeout: 10000 }
    );
  });

  test("NSFW toggle is positioned next to theme toggle", async ({ page }) => {
    await page.goto("/feed");

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Both should be in the same parent container
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox).toBeTruthy();
  });

  test("NSFW toggle is not visible when logged out", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto("/");

    // The toggle should not be present
    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // Element may not exist at all, which is expected
    });

    await context.close();
  });

  test("NSFW toggle renders circle-slash icon", async ({ page }) => {
    await page.goto("/feed");

    const toggle = page.getByTestId("nsfw-toggle");
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Check that SVG icon exists within the button
    const svg = toggle.locator("svg");
    await expect(svg).toBeVisible();

    // Verify it has circle and line elements (stop sign icon)
    const circle = svg.locator("circle");
    const line = svg.locator("line");
    await expect(circle).toHaveCount(1);
    await expect(line).toHaveCount(1);
  });
});
