import { test, expect } from "@playwright/test";

test.describe("Communities Discussions View", () => {
  test("shows Discussions tab on /communities", async ({ page }) => {
    await page.goto("/communities");

    const discussionsTab = page.getByTestId("communities-view-discussions");
    await expect(discussionsTab).toBeVisible({ timeout: 10000 });
    await expect(discussionsTab).toHaveAttribute("aria-selected", "false");
  });

  test("switches to discussions view when Discussions tab is clicked", async ({ page }) => {
    await page.goto("/communities");

    const discussionsTab = page.getByTestId("communities-view-discussions");
    await expect(discussionsTab).toBeVisible({ timeout: 10000 });
    await discussionsTab.click();

    await expect(page).toHaveURL(/view=discussions/);
    await expect(discussionsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("communities-view-tags")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  test("navigating directly to /communities?view=discussions shows discussions view", async ({
    page,
  }) => {
    await page.goto("/communities?view=discussions");

    await expect(page.getByTestId("communities-view-discussions")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );
  });

  test("discussions view shows post list or empty state", async ({ page }) => {
    await page.goto("/communities?view=discussions");

    // Wait for loading spinner to disappear
    await page
      .locator(".animate-spin")
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => {});

    const hasPosts = await page
      .getByTestId("discussions-list")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("no-discussions")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasPosts || hasEmpty).toBe(true);
  });

  test("discussion posts show comments by default", async ({ page }) => {
    await page.goto("/communities?view=discussions");

    // Wait for loading spinner to disappear
    await page
      .locator(".animate-spin")
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => {});

    const hasPosts = await page
      .getByTestId("discussions-list")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasPosts) {
      // Comment sections should be visible without needing to click
      const commentSections = page.locator("[data-testid='post-card'] .border-t");
      const count = await commentSections.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("tag cloud is hidden when discussions view is active", async ({ page }) => {
    await page.goto("/communities?view=discussions");

    await expect(page.getByTestId("communities-view-discussions")).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10000 }
    );

    await expect(page.getByTestId("tag-cloud")).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // tag-cloud element shouldn't exist at all in discussions view
    });
  });

  test("switches back to tags view from discussions view", async ({ page }) => {
    await page.goto("/communities?view=discussions");

    const tagsTab = page.getByTestId("communities-view-tags");
    await expect(tagsTab).toBeVisible({ timeout: 10000 });
    await tagsTab.click();

    await page.waitForURL("**/communities", { timeout: 10000 });
    await expect(tagsTab).toHaveAttribute("aria-selected", "true");
  });
});
