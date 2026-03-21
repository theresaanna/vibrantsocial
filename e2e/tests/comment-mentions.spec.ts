import { test, expect } from "@playwright/test";
import { seedSecondTestUser, TEST_USER_2 } from "../helpers/db";

test.describe("Comment @ mention typeahead", () => {
  test.beforeAll(async () => {
    await seedSecondTestUser();
  });

  // Helper: ensure at least one post exists by creating one if needed
  async function ensurePostExists(page: import("@playwright/test").Page) {
    await page.goto("/feed");
    const existingPost = page.locator('[data-testid="post-card"]').first();
    const hasPost = await existingPost.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasPost) {
      await page.goto("/compose");
      const editor = page.locator('[contenteditable="true"]').first();
      await expect(editor).toBeVisible({ timeout: 10000 });
      await editor.click();
      await page.keyboard.type(`e2e comment test post ${Date.now()}`);
      await page.getByRole("button", { name: /post/i }).click();
      await expect(page).toHaveURL(/\/feed/, { timeout: 15000 });
    }
  }

  test("typing @ in comment input shows mention dropdown", async ({ page }) => {
    await ensurePostExists(page);

    // Wait for a post to appear
    const postCard = page.locator('[data-testid="post-card"]').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    // Click the comment button to expand comments
    const commentButton = postCard.getByRole("button", { name: /comment/i });
    await commentButton.click();

    // Find the mention input
    const mentionInput = postCard.getByTestId("mention-input");
    await expect(mentionInput).toBeVisible({ timeout: 5000 });

    // Type @ followed by the second test user's username prefix
    await mentionInput.fill(`@${TEST_USER_2.username.slice(0, 4)}`);

    // The mention dropdown should appear
    await expect(page.getByTestId("mention-dropdown")).toBeVisible({ timeout: 5000 });
  });

  test("selecting a mention from dropdown inserts @username", async ({ page }) => {
    await ensurePostExists(page);

    const postCard = page.locator('[data-testid="post-card"]').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const commentButton = postCard.getByRole("button", { name: /comment/i });
    await commentButton.click();

    const mentionInput = postCard.getByTestId("mention-input");
    await expect(mentionInput).toBeVisible({ timeout: 5000 });

    // Type @ to trigger mentions
    await mentionInput.fill(`@${TEST_USER_2.username.slice(0, 4)}`);

    // Wait for dropdown
    await expect(page.getByTestId("mention-dropdown")).toBeVisible({ timeout: 5000 });

    // Click the mention option
    const mentionOption = page.getByTestId(`mention-option-${TEST_USER_2.username}`);
    await expect(mentionOption).toBeVisible({ timeout: 3000 });
    await mentionOption.click();

    // The input should now contain the full @username
    await expect(mentionInput).toHaveValue(new RegExp(`@${TEST_USER_2.username}\\s`));

    // Dropdown should be closed
    await expect(page.getByTestId("mention-dropdown")).not.toBeVisible();
  });

  test("pressing Escape closes the mention dropdown", async ({ page }) => {
    await ensurePostExists(page);

    const postCard = page.locator('[data-testid="post-card"]').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const commentButton = postCard.getByRole("button", { name: /comment/i });
    await commentButton.click();

    const mentionInput = postCard.getByTestId("mention-input");
    await expect(mentionInput).toBeVisible({ timeout: 5000 });

    await mentionInput.fill(`@${TEST_USER_2.username.slice(0, 4)}`);
    await expect(page.getByTestId("mention-dropdown")).toBeVisible({ timeout: 5000 });

    // Press Escape
    await mentionInput.press("Escape");

    // Dropdown should close
    await expect(page.getByTestId("mention-dropdown")).not.toBeVisible();
  });

  test("no dropdown for text without @", async ({ page }) => {
    await ensurePostExists(page);

    const postCard = page.locator('[data-testid="post-card"]').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const commentButton = postCard.getByRole("button", { name: /comment/i });
    await commentButton.click();

    const mentionInput = postCard.getByTestId("mention-input");
    await expect(mentionInput).toBeVisible({ timeout: 5000 });

    // Type without @
    await mentionInput.fill("hello world");

    // No dropdown should appear
    await expect(page.getByTestId("mention-dropdown")).not.toBeVisible();
  });
});
