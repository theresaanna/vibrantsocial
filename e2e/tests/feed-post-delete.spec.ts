import { test, expect } from "@playwright/test";

test.describe("Post deletion from feed", () => {
  test("deleting a post removes it from the feed without page refresh", async ({ page }) => {
    // Create a post via the compose page
    const uniqueText = `e2e-delete-test-${Date.now()}`;
    await page.goto("/compose");

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type(uniqueText);

    const postButton = page.getByRole("button", { name: /post/i });
    await postButton.click();

    // Should redirect to feed
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

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
    const confirmButton = page.getByRole("button", { name: /delete/i }).last();
    await expect(confirmButton).toBeVisible({ timeout: 3000 });
    await confirmButton.click();

    // The post should be removed from the DOM without a page refresh
    await expect(postContent).not.toBeVisible({ timeout: 5000 });

    // Verify we're still on the feed page (no navigation happened)
    await expect(page).toHaveURL(/\/feed/);
  });

  test("deleted post does not leave an empty gap in the feed", async ({ page }) => {
    // First create a post so we have something to delete
    const uniqueText = `e2e-gap-test-${Date.now()}`;
    await page.goto("/compose");

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type(uniqueText);

    const postButton = page.getByRole("button", { name: /post/i });
    await postButton.click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });

    // Wait for post to appear
    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Count posts before deletion
    const postCountBefore = await page.locator('[data-testid="post-card"]').count();

    // Find and delete the post
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    const menuButton = postCard.getByTestId("post-menu-button");
    await menuButton.click();

    const deleteButton = postCard.getByTestId("post-delete-button");
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    const confirmButton = page.getByRole("button", { name: /delete/i }).last();
    await expect(confirmButton).toBeVisible({ timeout: 3000 });
    await confirmButton.click();

    // Wait for removal
    await expect(postContent).not.toBeVisible({ timeout: 5000 });

    // Post count should decrease
    const postCountAfter = await page.locator('[data-testid="post-card"]').count();
    expect(postCountAfter).toBeLessThan(postCountBefore);
  });
});
