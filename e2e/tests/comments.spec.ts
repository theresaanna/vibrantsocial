import { test, expect } from "@playwright/test";

// Helper to create a post and open comments
async function createPostAndOpenComments(page: import("@playwright/test").Page, label: string) {
  await page.goto("/compose");

  // Dismiss tag hint if visible
  const gotItButton = page.getByRole("button", { name: "Got it" });
  if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gotItButton.click();
  }

  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.waitForTimeout(300);

  const postText = `${label} ${Date.now()}`;
  await editor.pressSequentially(postText);
  await page.click('button:has-text("Post")');
  await page.waitForURL("**/feed", { timeout: 30000 });

  await expect(page.locator(`text=${postText}`)).toBeVisible({ timeout: 10000 });

  // Open comments by clicking the comment toggle
  const postCard = page.locator(`text=${postText}`).locator("..").locator("..").locator("..");
  const commentToggle = postCard.locator("button").filter({
    has: page.locator('svg path[d*="M12 20.25"]'),
  }).first();

  const hasToggle = await commentToggle.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasToggle) {
    await page.locator(`text=${postText}`).click();
    await page.waitForTimeout(1000);
  } else {
    await commentToggle.click();
  }

  return postText;
}

// Helper to write a comment
async function writeComment(page: import("@playwright/test").Page, text: string) {
  const commentInput = page.getByPlaceholder("Write a comment...");
  await expect(commentInput).toBeVisible({ timeout: 5000 });
  await commentInput.fill(text);
  await page.click('button:has-text("Reply")');
  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout: 10000 });
}

test.describe("Comments", () => {
  test("add a comment to a post", async ({ page }) => {
    const postText = await createPostAndOpenComments(page, "Comment test");

    const commentText = `Test comment ${Date.now()}`;
    await writeComment(page, commentText);

    // Comment should be visible in the feed
    await expect(page.locator(`text=${commentText}`)).toBeVisible();
  });

  test("reply to a comment (nesting)", async ({ page }) => {
    const postText = await createPostAndOpenComments(page, "Nesting test");

    // Write parent comment
    const parentText = `Parent comment ${Date.now()}`;
    await writeComment(page, parentText);

    // Click Reply on the parent comment
    const parentComment = page.locator(`text=${parentText}`);
    const replyButton = parentComment
      .locator("..")
      .locator("..")
      .locator('button:has-text("Reply")');
    await replyButton.click();

    // Write reply using the reply input
    const replyInput = page.getByPlaceholder(/Reply to/);
    await expect(replyInput).toBeVisible({ timeout: 5000 });
    const replyText = `Reply comment ${Date.now()}`;
    await replyInput.fill(replyText);

    const submitButton = page.locator('button[type="submit"]:has-text("Reply")');
    await submitButton.click();

    // Reply should appear
    await expect(page.locator(`text=${replyText}`)).toBeVisible({ timeout: 10000 });

    // Reply should be nested (inside a border-l container)
    const replyContainer = page.locator(".border-l-2").filter({
      has: page.locator(`text=${replyText}`),
    });
    await expect(replyContainer).toBeVisible();
  });

  test("edit own comment", async ({ page }) => {
    const postText = await createPostAndOpenComments(page, "Edit test");

    // Write a comment
    const commentText = `Edit me ${Date.now()}`;
    await writeComment(page, commentText);

    // Hover over the comment to reveal edit button
    await page.locator(`text=${commentText}`).hover();

    // Click edit button
    const editButton = page.locator('[data-testid="comment-edit-button"]').first();
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Edit input should appear with current content
    const editInput = page.locator('[data-testid="comment-edit-input"]');
    await expect(editInput).toBeVisible({ timeout: 3000 });

    // Clear and type new content
    await editInput.clear();
    const updatedText = `Updated comment ${Date.now()}`;
    await editInput.fill(updatedText);

    // Save
    const saveButton = page.locator('[data-testid="comment-edit-save"]');
    await saveButton.click();

    // Updated text should appear
    await expect(page.locator(`text=${updatedText}`)).toBeVisible({ timeout: 5000 });

    // "(edited)" indicator should show
    await expect(page.locator("text=(edited)")).toBeVisible({ timeout: 3000 });
  });

  test("delete own comment", async ({ page }) => {
    const postText = await createPostAndOpenComments(page, "Delete test");

    // Write a comment
    const commentText = `Delete me ${Date.now()}`;
    await writeComment(page, commentText);

    // Hover to reveal delete button
    await page.locator(`text=${commentText}`).hover();

    // Click delete
    const deleteButton = page.locator('[data-testid="comment-delete-button"]').first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Confirmation should appear
    await expect(page.locator("text=Delete this comment?")).toBeVisible({ timeout: 3000 });

    // Confirm deletion
    const confirmButton = page.locator('[data-testid="comment-delete-confirm"]');
    await confirmButton.click();

    // Comment should disappear
    await expect(page.locator(`text=${commentText}`)).not.toBeVisible({ timeout: 5000 });
  });

  test("comments appear nested on post detail page", async ({ page }) => {
    const postText = await createPostAndOpenComments(page, "Detail nesting");

    // Write parent comment
    const parentText = `Parent detail ${Date.now()}`;
    await writeComment(page, parentText);

    // Click Reply on the parent
    const parentComment = page.locator(`text=${parentText}`);
    const replyButton = parentComment
      .locator("..")
      .locator("..")
      .locator('button:has-text("Reply")');
    await replyButton.click();

    const replyInput = page.getByPlaceholder(/Reply to/);
    await expect(replyInput).toBeVisible({ timeout: 5000 });
    const replyText = `Reply detail ${Date.now()}`;
    await replyInput.fill(replyText);

    const submitButton = page.locator('button[type="submit"]:has-text("Reply")');
    await submitButton.click();
    await expect(page.locator(`text=${replyText}`)).toBeVisible({ timeout: 10000 });

    // Navigate to post detail page by clicking the post text
    await page.locator(`text=${postText}`).click();
    await page.waitForTimeout(2000);

    // Both parent and reply should be visible
    await expect(page.locator(`text=${parentText}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${replyText}`)).toBeVisible({ timeout: 10000 });

    // Reply should be nested
    const replyContainer = page.locator(".border-l-2").filter({
      has: page.locator(`text=${replyText}`),
    });
    await expect(replyContainer).toBeVisible();
  });
});
