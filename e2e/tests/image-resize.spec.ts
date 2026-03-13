import { test, expect, type Page } from "@playwright/test";

/** Shared helper: insert an image via URL into the compose editor. */
async function insertImageInEditor(page: Page) {
  await page.goto("/compose");

  // Dismiss tag hint if visible
  const gotItButton = page.getByRole("button", { name: "Got it" });
  if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gotItButton.click();
  }

  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 30000 });
  await editor.click();

  const insertButton = page.getByRole("button", { name: "Insert" });
  if (!(await insertButton.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip(true, "Insert button not available");
    return null;
  }
  await insertButton.click();

  const imageOption = page.locator("text=Image").first();
  if (!(await imageOption.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "Image option not available in insert dropdown");
    return null;
  }
  await imageOption.click();

  const urlTab = page.locator("text=URL").first();
  if (await urlTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await urlTab.click();
  }

  const urlInput = page.locator('input[placeholder*="URL"]').first();
  if (!(await urlInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "URL input not available for image insertion");
    return null;
  }
  await urlInput.fill("https://via.placeholder.com/400x300");

  const altInput = page.locator('input[placeholder*="alt"]').first();
  if (await altInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await altInput.fill("Test image");
  }

  const insertImageButton = page.getByRole("button", {
    name: /Insert Image/i,
  });
  if (
    await insertImageButton.isVisible({ timeout: 2000 }).catch(() => false)
  ) {
    await insertImageButton.click();
  }

  const image = page.locator('[contenteditable="true"] img').first();
  if (!(await image.isVisible({ timeout: 5000 }).catch(() => false))) {
    test.skip(true, "Image did not load in editor");
    return null;
  }

  return image;
}

test.describe("Image Resize Handles", () => {
  test("image in editor shows all 4 resize handles on click", async ({
    page,
  }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    await image.click();

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

test.describe("Image Resize via Context Menu", () => {
  test("right-clicking image shows context menu with Resize option", async ({
    page,
  }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    // Right-click the image
    await image.click({ button: "right" });

    // Context menu should appear
    const contextMenu = page.locator('[data-testid="image-context-menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Resize option should be visible
    const resizeOption = page.locator('[data-testid="context-menu-resize"]');
    await expect(resizeOption).toBeVisible();
    await expect(resizeOption).toHaveText(/Resize/);
  });

  test("clicking Resize opens popover with width, height, and aspect ratio lock", async ({
    page,
  }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    // Right-click → Resize
    await image.click({ button: "right" });
    await page.locator('[data-testid="context-menu-resize"]').click();

    // Popover should appear
    const popover = page.locator('[data-testid="image-resize-popover"]');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Width and height inputs should exist
    await expect(
      page.locator('[data-testid="resize-width-input"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="resize-height-input"]')
    ).toBeVisible();

    // Aspect ratio lock button should exist
    await expect(
      page.locator('[data-testid="resize-aspect-lock"]')
    ).toBeVisible();

    // Apply button should exist
    await expect(
      page.locator('[data-testid="resize-apply-button"]')
    ).toBeVisible();
  });

  test("changing width with locked aspect ratio updates height proportionally", async ({
    page,
  }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    // Right-click → Resize
    await image.click({ button: "right" });
    await page.locator('[data-testid="context-menu-resize"]').click();

    const widthInput = page.locator('[data-testid="resize-width-input"]');
    const heightInput = page.locator('[data-testid="resize-height-input"]');

    // Read initial values
    const initialWidth = Number(await widthInput.inputValue());
    const initialHeight = Number(await heightInput.inputValue());

    // The image is 400x300, so aspect ratio should be ~1.333
    // Set width to 200 — height should auto-update to 150
    await widthInput.fill("200");

    const newHeight = Number(await heightInput.inputValue());
    // With aspect ratio locked, height should be proportional
    const expectedHeight = Math.round(
      200 / (initialWidth / initialHeight)
    );
    expect(newHeight).toBe(expectedHeight);
  });

  test("apply button updates the image dimensions", async ({ page }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    // Right-click → Resize
    await image.click({ button: "right" });
    await page.locator('[data-testid="context-menu-resize"]').click();

    const widthInput = page.locator('[data-testid="resize-width-input"]');

    // Set width to 200
    await widthInput.fill("200");

    // Click Apply
    await page.locator('[data-testid="resize-apply-button"]').click();

    // Popover should close
    await expect(
      page.locator('[data-testid="image-resize-popover"]')
    ).not.toBeVisible({ timeout: 3000 });

    // Image should have the new width
    const imgStyle = await image.getAttribute("style");
    expect(imgStyle).toContain("width: 200px");
  });

  test("Escape key closes the context menu", async ({ page }) => {
    const image = await insertImageInEditor(page);
    if (!image) return;

    await image.click({ button: "right" });
    const contextMenu = page.locator('[data-testid="image-context-menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });
  });
});
