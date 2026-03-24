import { test, expect } from "@playwright/test";

test.describe("Post Creation", () => {
  test("create a post and verify it appears in feed", async ({ page }) => {
    await page.goto("/compose");
    await expect(page).toHaveURL(/\/compose/);

    // Dismiss the tag suggestion hint if it appears (first-time tooltip)
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // The Lexical editor renders a contenteditable div
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300); // Let Lexical initialize focus

    // Type a unique post so we can find it later
    const postText = `E2E test post ${Date.now()}`;
    await editor.pressSequentially(postText);

    // Click the Post button
    await page.click('button:has-text("Post")');

    // The ComposeClient redirects to /feed after successful post creation
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Verify the post appears in the feed
    await expect(page.locator(`text=${postText}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("compose page shows editor with placeholder", async ({ page }) => {
    await page.goto("/compose");

    await expect(
      page.locator("text=What's on your mind?")
    ).toBeVisible({ timeout: 10000 });

    // Post button should be present
    await expect(page.locator('button:has-text("Post")')).toBeVisible();
  });

  test("content warnings section is togglable", async ({ page }) => {
    await page.goto("/compose");

    // Scroll to the Content Warnings button (it's near the bottom of the compose form)
    const toggle = page.getByRole("button", { name: "Content Warnings" });
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Click to expand
    await toggle.click();
    await page.waitForTimeout(300);

    // NSFW checkbox should appear
    await expect(page.getByRole("checkbox", { name: "NSFW" })).toBeVisible({ timeout: 5000 });
    // Sensitive and Graphic/Explicit are visible as text (may be disabled spans if not age-verified)
    await expect(page.getByText("Sensitive")).toBeVisible();
    await expect(page.getByText("Graphic/Explicit")).toBeVisible();

    // Click to collapse
    await toggle.click();

    // Content flags should be hidden
    await expect(page.getByRole("checkbox", { name: "NSFW" })).not.toBeVisible({ timeout: 5000 });
  });
});
