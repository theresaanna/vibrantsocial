import { test, expect } from "@playwright/test";

test.describe("Post deletion from feed", () => {
  test("deleting a post removes it from the feed without page refresh", async ({ page }) => {
    // Create a post first so we have something to delete
    await page.goto("/feed");

    // Wait for the composer to be ready
    const composer = page.locator('[data-testid="post-composer"]');
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Create a post with unique content we can identify
    const uniqueText = `e2e-delete-test-${Date.now()}`;
    await composer.click();
    await page.keyboard.type(uniqueText);

    // Submit the post
    const postButton = page.getByRole("button", { name: /post/i });
    await postButton.click();

    // Wait for the post to appear in the feed
    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Find the post card containing our text
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");

    // Open the post menu
    const menuButton = postCard.getByTestId("post-menu-button");
    await menuButton.click();

    // Click delete
    const deleteButton = postCard.getByTestId("post-delete-button");
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    // Confirm deletion in the dialog
    const confirmButton = postCard.getByRole("button", { name: /delete/i }).last();
    await confirmButton.click();

    // The post should be removed from the DOM without a page refresh
    await expect(postContent).not.toBeVisible({ timeout: 5000 });

    // Verify we're still on the feed page (no navigation happened)
    await expect(page).toHaveURL(/\/feed/);
  });

  test("deleted post does not leave an empty gap in the feed", async ({ page }) => {
    await page.goto("/feed");

    // Wait for posts to load
    const firstPost = page.locator('[data-testid="post-card"]').first();
    await expect(firstPost).toBeVisible({ timeout: 10000 });

    // Count posts before deletion
    const postCountBefore = await page.locator('[data-testid="post-card"]').count();

    // Only proceed if there's a post we authored (has menu button)
    const menuButton = firstPost.getByTestId("post-menu-button");
    const hasMenu = await menuButton.isVisible().catch(() => false);

    if (!hasMenu) {
      test.skip();
      return;
    }

    // Delete the first post
    await menuButton.click();
    const deleteButton = firstPost.getByTestId("post-delete-button");
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    const confirmButton = firstPost.getByRole("button", { name: /delete/i }).last();
    await confirmButton.click();

    // Wait for removal
    await page.waitForTimeout(1000);

    // Post count should decrease
    const postCountAfter = await page.locator('[data-testid="post-card"]').count();
    expect(postCountAfter).toBeLessThan(postCountBefore);
  });
});
