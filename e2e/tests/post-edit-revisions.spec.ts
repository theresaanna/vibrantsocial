import { test, expect } from "@playwright/test";
import pg from "pg";
import { TEST_USER } from "../helpers/db";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupTestPosts() {
  const pool = createPool();
  try {
    const users = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    const userId = users.rows[0]?.id;
    if (!userId) return;

    await pool.query(
      `DELETE FROM "PostRevision" WHERE "postId" IN (SELECT id FROM "Post" WHERE "authorId" = $1)`,
      [userId]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Post Editing & Revisions @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.afterAll(async () => {
    await cleanupTestPosts();
  });

  test("edit button appears in post menu for own posts", async ({ page }) => {
    // Create a post first
    const uniqueText = `e2e-edit-menu-${Date.now()}`;
    await page.goto("/compose");

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(uniqueText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();

    await expect(postCard.getByTestId("post-edit-button")).toBeVisible({ timeout: 3000 });
    await expect(postCard.getByTestId("post-revision-history-button")).toBeVisible();
  });

  test("can edit a post and see (edited) indicator", async ({ page }) => {
    const uniqueText = `e2e-edit-test-${Date.now()}`;
    const editedSuffix = " [EDITED]";

    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(uniqueText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Open edit mode
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-edit-button").click();

    // Edit form should appear
    const editEditor = postCard.getByTestId("post-edit-editor");
    await expect(editEditor).toBeVisible({ timeout: 10000 });

    // Type additional text in the edit editor
    const editInput = editEditor.locator('[contenteditable="true"]').first();
    await editInput.click();
    await editInput.press("End");
    await editInput.pressSequentially(editedSuffix, { delay: 10 });

    // Save the edit
    await postCard.getByTestId("post-edit-save").click();

    // Should exit edit mode and show updated content
    await expect(editEditor).not.toBeVisible({ timeout: 10000 });
    await expect(postCard.locator(`text=${uniqueText}${editedSuffix}`)).toBeVisible({
      timeout: 10000,
    });

    // Should show (edited) indicator
    await expect(postCard.locator("text=(edited)")).toBeVisible({ timeout: 5000 });
  });

  test("cancel edit discards changes", async ({ page }) => {
    const uniqueText = `e2e-cancel-edit-${Date.now()}`;

    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(uniqueText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Open edit mode
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-edit-button").click();

    const editEditor = postCard.getByTestId("post-edit-editor");
    await expect(editEditor).toBeVisible({ timeout: 10000 });

    // Type something then cancel
    const editInput = editEditor.locator('[contenteditable="true"]').first();
    await editInput.click();
    await editInput.press("End");
    await editInput.pressSequentially(" SHOULD NOT APPEAR", { delay: 10 });

    await postCard.getByTestId("post-edit-cancel").click();

    // Edit mode should close
    await expect(editEditor).not.toBeVisible({ timeout: 5000 });

    // Original text should still be there, without the cancelled addition
    await expect(postCard.locator(`text=${uniqueText}`)).toBeVisible();
    await expect(postCard.locator("text=SHOULD NOT APPEAR")).not.toBeVisible();
  });

  test("revision history shows previous versions", async ({ page }) => {
    const uniqueText = `e2e-revision-${Date.now()}`;
    const editedText = " v2";

    // Create and edit a post to generate a revision
    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(uniqueText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Edit the post to create a revision
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-edit-button").click();

    const editEditor = postCard.getByTestId("post-edit-editor");
    await expect(editEditor).toBeVisible({ timeout: 10000 });

    const editInput = editEditor.locator('[contenteditable="true"]').first();
    await editInput.click();
    await editInput.press("End");
    await editInput.pressSequentially(editedText, { delay: 10 });
    await postCard.getByTestId("post-edit-save").click();
    await expect(editEditor).not.toBeVisible({ timeout: 10000 });

    // Open revision history
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-revision-history-button").click();

    // Revision modal should appear
    const revisionModal = page.getByTestId("post-revision-history");
    await expect(revisionModal).toBeVisible({ timeout: 10000 });
    await expect(revisionModal.locator("text=Post Revision History")).toBeVisible();

    // Should have at least one revision item
    const revisionItems = revisionModal.locator('[data-testid^="revision-item-"]');
    await expect(revisionItems.first()).toBeVisible({ timeout: 5000 });
    expect(await revisionItems.count()).toBeGreaterThanOrEqual(1);
  });

  test("can restore a previous revision", async ({ page }) => {
    const originalText = `e2e-restore-orig-${Date.now()}`;
    const editedSuffix = " EDITED-AWAY";

    // Create a post
    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(originalText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${originalText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Edit the post
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-edit-button").click();

    const editEditor = postCard.getByTestId("post-edit-editor");
    await expect(editEditor).toBeVisible({ timeout: 10000 });

    const editInput = editEditor.locator('[contenteditable="true"]').first();
    await editInput.click();
    await editInput.press("End");
    await editInput.pressSequentially(editedSuffix, { delay: 10 });
    await postCard.getByTestId("post-edit-save").click();
    await expect(editEditor).not.toBeVisible({ timeout: 10000 });

    // Verify edited content
    await expect(postCard.locator(`text=${originalText}${editedSuffix}`)).toBeVisible({
      timeout: 10000,
    });

    // Open revision history and restore original
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-revision-history-button").click();

    const revisionModal = page.getByTestId("post-revision-history");
    await expect(revisionModal).toBeVisible({ timeout: 10000 });

    // Click the first (most recent) revision to select it
    const firstRevision = revisionModal.locator('[data-testid^="revision-item-"]').first();
    await firstRevision.click();

    // Restore button should be visible
    const restoreButton = revisionModal.getByTestId("revision-restore-button");
    await expect(restoreButton).toBeVisible({ timeout: 5000 });
    await restoreButton.click();

    // Modal should close after restore
    await expect(revisionModal).not.toBeVisible({ timeout: 10000 });

    // Post should show the original text (without the edited suffix)
    await expect(postCard.locator(`text=${originalText}`)).toBeVisible({ timeout: 10000 });
  });

  test("revision history close button works", async ({ page }) => {
    // Navigate to feed and find any post by the test user that has revisions
    // We'll create a fresh one with an edit
    const uniqueText = `e2e-close-rev-${Date.now()}`;

    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await editor.pressSequentially(uniqueText, { delay: 10 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    const postContent = page.locator(`text=${uniqueText}`);
    await expect(postContent).toBeVisible({ timeout: 10000 });

    // Edit to create a revision
    const postCard = postContent.locator("xpath=ancestor::*[@data-testid='post-card']");
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-edit-button").click();

    const editEditor = postCard.getByTestId("post-edit-editor");
    await expect(editEditor).toBeVisible({ timeout: 10000 });

    const editInput = editEditor.locator('[contenteditable="true"]').first();
    await editInput.click();
    await editInput.press("End");
    await editInput.pressSequentially(" edited", { delay: 10 });
    await postCard.getByTestId("post-edit-save").click();
    await expect(editEditor).not.toBeVisible({ timeout: 10000 });

    // Open revision history
    await postCard.getByTestId("post-menu-button").click();
    await postCard.getByTestId("post-revision-history-button").click();

    const revisionModal = page.getByTestId("post-revision-history");
    await expect(revisionModal).toBeVisible({ timeout: 10000 });

    // Close via close button
    await revisionModal.getByTestId("revision-close-button").click();
    await expect(revisionModal).not.toBeVisible({ timeout: 5000 });
  });
});
