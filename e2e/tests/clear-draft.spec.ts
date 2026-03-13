import { test, expect } from "@playwright/test";

test.describe("Clear Draft", () => {
  test("clear draft button appears after typing and clears editor", async ({
    page,
  }) => {
    await page.goto("/compose");
    await expect(page).toHaveURL(/\/compose/, { timeout: 15000 });

    // Dismiss tooltips
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Wait for editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(500);

    // Type some content to trigger a draft save
    const draftText = `Draft test ${Date.now()}`;
    await editor.pressSequentially(draftText);

    // Wait until the draft is actually saved to localStorage (debounce is 3s)
    await page.waitForFunction(
      () => localStorage.getItem("vibrant-draft:compose") !== null,
      { timeout: 15000 }
    );

    // Reload so ClearDraftButton initializes with the saved draft from localStorage
    await page.reload();
    const editorAfterReload = page.locator('[contenteditable="true"]').first();
    await expect(editorAfterReload).toBeVisible({ timeout: 30000 });

    // Dismiss any tooltips/popups that may appear after reload
    const gotItButton2 = page.getByRole("button", { name: "Got it" });
    if (await gotItButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton2.click();
    }

    // Wait for the draft to be restored in the editor
    await expect(editorAfterReload).toContainText(draftText, {
      timeout: 15000,
    });

    // The "Clear draft" button should now be visible
    const clearButton = page.getByRole("button", { name: "Clear draft" });
    await expect(clearButton).toBeVisible({ timeout: 15000 });

    // Click it
    await clearButton.click();

    // The editor content should be cleared
    await expect(editorAfterReload).not.toContainText(draftText, {
      timeout: 10000,
    });

    // The clear draft button should disappear (no draft left)
    await expect(clearButton).not.toBeVisible({ timeout: 10000 });
  });

  test("clear draft button is not visible on empty editor", async ({
    page,
  }) => {
    // Clear any existing draft first
    await page.goto("/compose");
    await page.evaluate(() =>
      localStorage.removeItem("vibrant-draft:compose")
    );
    await page.reload();
    await expect(page).toHaveURL(/\/compose/, { timeout: 15000 });

    // Wait for editor to load
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });

    // The clear draft button should not be visible when there's no saved draft
    await expect(
      page.getByRole("button", { name: "Clear draft" })
    ).not.toBeVisible({ timeout: 5000 });
  });
});
