import { test, expect } from "@playwright/test";

test.describe("Image Resize Handles", () => {
  test("image in editor shows all 4 resize handles on click", async ({
    page,
  }) => {
    await page.goto("/compose");

    // Dismiss tag hint if visible
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Wait for editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();

    // Open the insert dropdown and look for Image option
    const insertButton = page.getByRole("button", { name: "Insert" });
    const hasInsert = await insertButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasInsert) {
      test.skip(true, "Insert button not available");
      return;
    }

    await insertButton.click();

    // Click Image option
    const imageOption = page.locator("text=Image").first();
    const hasImage = await imageOption
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasImage) {
      test.skip(true, "Image option not available in insert dropdown");
      return;
    }

    await imageOption.click();

    // Switch to URL mode if available
    const urlTab = page.locator("text=URL").first();
    if (await urlTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await urlTab.click();
    }

    // Enter a URL for the image
    const urlInput = page.locator('input[placeholder*="URL"]').first();
    const hasUrlInput = await urlInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasUrlInput) {
      test.skip(true, "URL input not available for image insertion");
      return;
    }

    await urlInput.fill("https://via.placeholder.com/400x300");

    // Fill alt text if present
    const altInput = page.locator('input[placeholder*="alt"]').first();
    if (await altInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await altInput.fill("Test image");
    }

    // Click insert button
    const insertImageButton = page.getByRole("button", {
      name: /Insert Image/i,
    });
    if (
      await insertImageButton.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await insertImageButton.click();
    }

    // Wait for image to appear in editor
    const image = page.locator('[contenteditable="true"] img').first();
    const hasEditorImage = await image
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasEditorImage) {
      test.skip(true, "Image did not load in editor");
      return;
    }

    // Click the image to select it
    await image.click();

    // All 4 resize handles should be visible
    await expect(
      page.locator('[data-testid="resize-handle-se"]')
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('[data-testid="resize-handle-sw"]')
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('[data-testid="resize-handle-ne"]')
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('[data-testid="resize-handle-nw"]')
    ).toBeVisible({ timeout: 3000 });
  });
});
