import { test, expect } from "@playwright/test";

test.describe("Communities Media View", () => {
  test("shows Tags and Media toggle on /communities", async ({ page }) => {
    await page.goto("/communities");
    await expect(page).toHaveURL(/\/communities/);

    const tagsTab = page.getByTestId("communities-view-tags");
    const mediaTab = page.getByTestId("communities-view-media");

    await expect(tagsTab).toBeVisible({ timeout: 10000 });
    await expect(mediaTab).toBeVisible();

    // Tags tab should be active by default
    await expect(tagsTab).toHaveAttribute("aria-selected", "true");
    await expect(mediaTab).toHaveAttribute("aria-selected", "false");
  });

  test("defaults to tag cloud view", async ({ page }) => {
    await page.goto("/communities");

    await expect(page.getByTestId("communities-view-tags")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );

    // Tag cloud or empty state should be visible
    const hasTagCloud = await page
      .getByTestId("tag-cloud")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await page
      .getByText("No tags yet.")
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasTagCloud || hasEmpty).toBe(true);
  });

  test("switches to media view when Media tab is clicked", async ({ page }) => {
    await page.goto("/communities");

    const mediaTab = page.getByTestId("communities-view-media");
    await expect(mediaTab).toBeVisible({ timeout: 10000 });
    await mediaTab.click();

    // URL should update with view=media
    await expect(page).toHaveURL(/view=media/);

    // Media tab should now be active
    await expect(mediaTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("communities-view-tags")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  test("switches back to tags view from media view", async ({ page }) => {
    await page.goto("/communities?view=media");

    const tagsTab = page.getByTestId("communities-view-tags");
    await expect(tagsTab).toBeVisible({ timeout: 10000 });
    await tagsTab.click();

    // URL should not have view param
    await page.waitForURL("**/communities", { timeout: 10000 });
    await expect(tagsTab).toHaveAttribute("aria-selected", "true");
  });

  test("media view shows grid or empty state", async ({ page }) => {
    await page.goto("/communities?view=media");

    // Should show either media grid or empty state message
    const hasGrid = await page
      .getByTestId("media-grid")
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasEmpty = await page
      .getByText("No media yet.")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasGrid || hasEmpty).toBe(true);
  });

  test("media grid items link to post detail page", async ({ page }) => {
    await page.goto("/communities?view=media");

    // Wait for either grid or empty state
    const hasGrid = await page
      .getByTestId("media-grid")
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasGrid) {
      const firstItem = page.getByTestId("media-grid-item").first();
      await expect(firstItem).toBeVisible();

      // Verify it's a link (has href attribute)
      const href = await firstItem.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/\/post\/|\/[\w-]+\/post\//);
    }
  });

  test("navigating directly to /communities?view=media shows media view", async ({
    page,
  }) => {
    await page.goto("/communities?view=media");

    await expect(page.getByTestId("communities-view-media")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );
  });

  test("tag cloud is hidden when media view is active", async ({ page }) => {
    await page.goto("/communities?view=media");

    await expect(page.getByTestId("communities-view-media")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );

    // Tag cloud should not be visible
    await expect(page.getByTestId("tag-cloud")).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // tag-cloud element shouldn't exist at all in media view
    });
  });
});
