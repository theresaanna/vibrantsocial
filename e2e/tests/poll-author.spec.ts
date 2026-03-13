import { test, expect } from "@playwright/test";

test.describe("Poll Author Results", () => {
  test("create a post with poll and see results as author", async ({
    page,
  }) => {
    await page.goto("/compose");

    // Dismiss tag hint if visible
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Wait for editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    // Type some text first
    await editor.pressSequentially(`Poll author test ${Date.now()}`);

    // Click Poll button in toolbar
    const pollButton = page.getByRole("button", { name: "Poll" });
    await expect(pollButton).toBeVisible({ timeout: 5000 });
    await pollButton.click();

    // Fill poll modal
    await expect(
      page.getByRole("heading", { name: "Insert Poll" })
    ).toBeVisible({ timeout: 5000 });

    await page
      .locator('input[placeholder="Poll question"]')
      .fill("Author poll test?");
    await page.locator('input[placeholder="Option 1"]').fill("Choice A");
    await page.locator('input[placeholder="Option 2"]').fill("Choice B");

    // Insert poll
    await page.getByRole("button", { name: "Insert Poll" }).click();
    await expect(page.locator("text=Author poll test?")).toBeVisible({
      timeout: 5000,
    });

    // Submit post
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Find the poll on feed - author should see results (percentages displayed)
    await expect(page.locator("text=Author poll test?").first()).toBeVisible({
      timeout: 10000,
    });

    // Author should see the results: percentage text and disabled buttons
    // The poll buttons should be disabled (showing results, not votable)
    const pollOption = page
      .locator("button", { hasText: "Choice A" })
      .first();
    await expect(pollOption).toBeVisible({ timeout: 5000 });
    await expect(pollOption).toBeDisabled();

    // Should show vote count
    await expect(page.locator("text=0 votes").first()).toBeVisible({
      timeout: 5000,
    });
  });
});
