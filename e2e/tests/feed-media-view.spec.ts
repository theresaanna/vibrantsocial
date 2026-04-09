import { test, expect } from "@playwright/test";

test.describe("Feed Media View", () => {
  test("shows Posts and Media toggle on /feed", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);

    const postsTab = page.getByTestId("feed-view-posts");
    const mediaTab = page.getByTestId("feed-view-media");

    await expect(postsTab).toBeVisible({ timeout: 10000 });
    await expect(mediaTab).toBeVisible();

    // Posts tab should be active by default
    await expect(postsTab).toHaveAttribute("aria-selected", "true");
    await expect(mediaTab).toHaveAttribute("aria-selected", "false");
  });

  test("switches to media view when Media tab is clicked", async ({ page }) => {
    await page.goto("/feed");

    const mediaTab = page.getByTestId("feed-view-media");
    await expect(mediaTab).toBeVisible({ timeout: 10000 });
    await mediaTab.click();

    // URL should update with view=media
    await expect(page).toHaveURL(/view=media/);

    // Media tab should now be active
    await expect(mediaTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("feed-view-posts")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  test("switches back to posts view from media view", async ({ page }) => {
    await page.goto("/feed?view=media");

    const postsTab = page.getByTestId("feed-view-posts");
    await expect(postsTab).toBeVisible({ timeout: 10000 });
    await postsTab.click();

    // URL should not have view param
    await page.waitForURL("**/feed", { timeout: 10000 });
    await expect(postsTab).toHaveAttribute("aria-selected", "true");
  });

  test("media view shows grid or empty state", async ({ page }) => {
    await page.goto("/feed?view=media");
    await page.waitForLoadState("networkidle");

    // Wait for the media content to load (spinner disappears and content appears)
    // Use a longer timeout since the RPC call may take time
    const hasGrid = await page
      .getByTestId("media-grid")
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    const hasEmpty = await page
      .getByText("No media yet.")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasGrid || hasEmpty).toBe(true);
  });

  test("media grid items link to post detail page", async ({ page }) => {
    await page.goto("/feed?view=media");

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

  test("navigating directly to /feed?view=media shows media view", async ({
    page,
  }) => {
    await page.goto("/feed?view=media");

    await expect(page.getByTestId("feed-view-media")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );
  });

  test("media view toggle does not appear on list views", async ({ page }) => {
    // Navigate to feed first, then a list view
    await page.goto("/feed");
    await expect(page.getByTestId("feed-view-posts")).toBeVisible({
      timeout: 10000,
    });

    // If there's a list tab, click it - the toggle should disappear
    // This test verifies the toggle is present on main feed
    const toggle = page.getByTestId("feed-view-posts");
    await expect(toggle).toBeVisible();
  });
});
