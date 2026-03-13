import { test, expect } from "@playwright/test";

// Helper to create a post and open comments
async function createPostAndOpenComments(
  page: import("@playwright/test").Page,
  label: string
) {
  await page.goto("/compose");

  const gotItButton = page.getByRole("button", { name: "Got it" });
  if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gotItButton.click();
  }

  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 30000 });
  await editor.click();
  await page.waitForTimeout(300);

  const postText = `${label} ${Date.now()}`;
  await editor.pressSequentially(postText);
  await page.click('button:has-text("Post")');
  await page.waitForURL("**/feed", { timeout: 30000 });

  await expect(page.locator(`text=${postText}`)).toBeVisible({
    timeout: 10000,
  });

  const commentToggle = page
    .getByRole("button", { name: "Toggle comments" })
    .first();
  await expect(commentToggle).toBeVisible({ timeout: 5000 });
  await commentToggle.click();

  return postText;
}

// Helper to write a comment and re-fetch (no Ably in CI)
async function writeComment(
  page: import("@playwright/test").Page,
  text: string
) {
  const commentInput = page.getByPlaceholder("Write a comment...");
  await expect(commentInput).toBeVisible({ timeout: 10000 });
  await commentInput.fill(text);
  await page.click('button:has-text("Reply")');

  // Wait for server action, then toggle comments to re-fetch
  await page.waitForTimeout(2000);
  const toggle = page
    .getByRole("button", { name: "Toggle comments" })
    .first();
  await toggle.click();
  await toggle.click();

  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout: 15000 });
}

test.describe("Comment Emoji Reactions", () => {
  test("add emoji reaction to a comment", async ({ page }) => {
    await createPostAndOpenComments(page, "Reaction test post");

    const commentText = `Test comment for reactions ${Date.now()}`;
    await writeComment(page, commentText);

    // Hover over the comment to reveal the reaction button
    await page.locator(`text=${commentText}`).hover();

    // Click the add reaction button (smiley face icon)
    const reactionButton = page
      .locator('[data-testid="comment-add-reaction"]')
      .first();
    await expect(reactionButton).toBeVisible({ timeout: 5000 });
    await reactionButton.click();

    // The emoji picker should appear
    const emojiPicker = page.locator('[data-testid="comment-emoji-picker"]');
    await expect(emojiPicker).toBeVisible({ timeout: 5000 });

    // Click a common emoji (thumbs up is usually available)
    const thumbsUpEmoji = emojiPicker
      .locator('button[data-unified="1f44d"]')
      .first();
    const hasThumbsUp = await thumbsUpEmoji
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasThumbsUp) {
      await thumbsUpEmoji.click();
    } else {
      const firstEmoji = emojiPicker.locator("button.epr-emoji").first();
      await expect(firstEmoji).toBeVisible({ timeout: 3000 });
      await firstEmoji.click();
    }

    // The emoji picker should close
    await expect(emojiPicker).not.toBeVisible({ timeout: 3000 });

    // A reaction badge should appear on the comment
    const reactionBadge = page
      .locator('[data-testid="comment-reaction-badge"]')
      .first();
    await expect(reactionBadge).toBeVisible({ timeout: 5000 });

    // The badge should show count of 1
    await expect(reactionBadge).toContainText("1");

    // The badge should have the blue highlighted style (since we reacted)
    await expect(reactionBadge).toHaveClass(/border-blue-300/);
  });

  test("toggle reaction off by clicking the badge", async ({ page }) => {
    await createPostAndOpenComments(page, "Toggle reaction post");

    const commentText = `Toggle test comment ${Date.now()}`;
    await writeComment(page, commentText);

    // Add a reaction
    await page.locator(`text=${commentText}`).hover();
    const reactionButton = page
      .locator('[data-testid="comment-add-reaction"]')
      .first();
    await expect(reactionButton).toBeVisible({ timeout: 5000 });
    await reactionButton.click();

    const emojiPicker = page.locator('[data-testid="comment-emoji-picker"]');
    await expect(emojiPicker).toBeVisible({ timeout: 5000 });

    const firstEmoji = emojiPicker.locator("button.epr-emoji").first();
    await expect(firstEmoji).toBeVisible({ timeout: 3000 });
    await firstEmoji.click();

    // Badge should appear
    const reactionBadge = page
      .locator('[data-testid="comment-reaction-badge"]')
      .first();
    await expect(reactionBadge).toBeVisible({ timeout: 5000 });
    await expect(reactionBadge).toContainText("1");

    // Click the badge to toggle the reaction off
    await reactionBadge.click();

    // Badge should disappear (since count goes to 0)
    await expect(reactionBadge).not.toBeVisible({ timeout: 5000 });
  });

  test("react to a reply comment", async ({ page }) => {
    await createPostAndOpenComments(page, "Reply reaction post");

    // Write a parent comment
    const parentComment = `Parent comment ${Date.now()}`;
    await writeComment(page, parentComment);

    // Click Reply on the parent comment to write a reply
    const replyButton = page
      .locator(`text=${parentComment}`)
      .locator("..")
      .locator("..")
      .locator('button:has-text("Reply")');
    await replyButton.click();

    // Write a reply
    const replyInput = page.getByPlaceholder(/Reply to/);
    await expect(replyInput).toBeVisible({ timeout: 5000 });
    const replyText = `Reply for reaction ${Date.now()}`;
    await replyInput.fill(replyText);

    // Submit the reply
    const submitButton = page.locator(
      'button[type="submit"]:has-text("Reply")'
    );
    await submitButton.click();

    // Wait for server action, then toggle comments to re-fetch
    await page.waitForTimeout(2000);
    const toggle = page
      .getByRole("button", { name: "Toggle comments" })
      .first();
    await toggle.click();
    await toggle.click();

    await expect(page.locator(`text=${replyText}`)).toBeVisible({
      timeout: 15000,
    });

    // React to the reply
    await page.locator(`text=${replyText}`).hover();
    const reactionButton = page
      .locator(`text=${replyText}`)
      .locator("..")
      .locator("..")
      .locator('[data-testid="comment-add-reaction"]');
    await expect(reactionButton).toBeVisible({ timeout: 5000 });
    await reactionButton.click();

    const emojiPicker = page.locator('[data-testid="comment-emoji-picker"]');
    await expect(emojiPicker).toBeVisible({ timeout: 5000 });

    const firstEmoji = emojiPicker.locator("button.epr-emoji").first();
    await expect(firstEmoji).toBeVisible({ timeout: 3000 });
    await firstEmoji.click();

    // Badge should appear near the reply
    const replyContainer = page
      .locator(`text=${replyText}`)
      .locator("..")
      .locator("..");
    const reactionBadge = replyContainer
      .locator('[data-testid="comment-reaction-badge"]')
      .first();
    await expect(reactionBadge).toBeVisible({ timeout: 5000 });
    await expect(reactionBadge).toContainText("1");
  });
});
