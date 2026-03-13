import { test, expect } from "@playwright/test";

test.describe("Clear Draft", () => {
  test("clear draft button appears after typing and clears editor", async ({
    page,
  }) => {
    await page.goto("/compose");
    await expect(page).toHaveURL(/\/compose/);

    // Dismiss tooltips
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Wait for editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.waitForTimeout(300);

    // Type some content to trigger a draft save
    const draftText = `Draft test ${Date.now()}`;
    await editor.pressSequentially(draftText);

    // Wait for the auto-save debounce (3s) plus a buffer
    await page.waitForTimeout(4000);

    // Reload so ClearDraftButton initializes with the saved draft from localStorage
    await page.reload();
    const editorAfterReload = page.locator('[contenteditable="true"]').first();
    await expect(editorAfterReload).toBeVisible({ timeout: 10000 });

    // Dismiss any tooltips/popups that may appear after reload
    const gotItButton2 = page.getByRole("button", { name: "Got it" });
    if (await gotItButton2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton2.click();
    }

    // The "Clear draft" button should now be visible
    const clearButton = page.getByRole("button", { name: "Clear draft" });
    await expect(clearButton).toBeVisible({ timeout: 5000 });

    // Click it (use force in case any overlay lingers)
    await clearButton.click({ force: true });

    // The editor content should be cleared
    await expect(page.locator(`text=${draftText}`)).not.toBeVisible({
      timeout: 3000,
    });

    // The clear draft button should disappear (no draft left)
    await expect(clearButton).not.toBeVisible({ timeout: 3000 });
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
    await expect(page).toHaveURL(/\/compose/);

    // Wait for editor to load
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });

    // The clear draft button should not be visible when there's no saved draft
    await expect(
      page.getByRole("button", { name: "Clear draft" })
    ).not.toBeVisible({ timeout: 2000 });
  });
});
