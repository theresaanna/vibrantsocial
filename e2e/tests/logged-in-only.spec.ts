import { test, expect } from "@playwright/test";

test.describe("Logged-in Only Posts", () => {
  test("Logged-in Only toggle is visible on compose page", async ({ page }) => {
    await page.goto("/compose");

    // Wait for editor to load
    await expect(
      page.locator("text=What's on your mind?")
    ).toBeVisible({ timeout: 10000 });

    // Logged-in Only button should be present
    await expect(page.locator("text=Logged-in Only")).toBeVisible();
  });

  test("can toggle Logged-in Only button", async ({ page }) => {
    test.fixme();
    await page.goto("/compose");

    await expect(
      page.locator("text=What's on your mind?")
    ).toBeVisible({ timeout: 10000 });

    // Find the Logged-in Only toggle and click it
    const toggle = page.locator("label").filter({ hasText: "Logged-in Only" });
    await expect(toggle).toBeVisible();

    // Click to enable
    await toggle.click();

    // The hidden input should now be "true"
    const hiddenInput = page.locator('input[name="isLoggedInOnly"]');
    await expect(hiddenInput).toHaveValue("true");

    // Click to disable
    await toggle.click();
    await expect(hiddenInput).toHaveValue("false");
  });

  test("info icon shows tooltip explaining the feature", async ({ page }) => {
    await page.goto("/compose");

    await expect(
      page.locator("text=What's on your mind?")
    ).toBeVisible({ timeout: 10000 });

    // Scroll down to make sure the bottom of the form is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Click the info icon next to "Logged-in Only"
    const infoButton = page.getByLabel("Logged-in only info");
    await expect(infoButton).toBeVisible();
    await infoButton.click();

    // Tooltip should appear with explanation text
    await expect(
      page.locator("text=people outside Vibrant can see your posts")
    ).toBeVisible({ timeout: 5000 });

    // Click "Got it" to dismiss
    await page.locator("text=Got it").click();

    // Tooltip should disappear
    await expect(
      page.locator("text=people outside Vibrant can see your posts")
    ).not.toBeVisible({ timeout: 3000 });
  });

  test("create a logged-in-only post and verify it appears in feed", async ({ page }) => {
    await page.goto("/compose");

    // Dismiss the tag suggestion hint if it appears
    const gotItHint = page.getByRole("button", { name: "Got it" });
    if (await gotItHint.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItHint.click();
    }

    // The Lexical editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    // Type a unique post
    const postText = `Logged-in only E2E test ${Date.now()}`;
    await editor.pressSequentially(postText);

    // Enable Logged-in Only
    const toggle = page.locator("label").filter({ hasText: "Logged-in Only" });
    await toggle.click();

    // Click the Post button
    await page.click('button:has-text("Post")');

    // The ComposeClient redirects to /feed after successful post creation
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Verify the post appears in the feed
    await expect(page.locator(`text=${postText}`)).toBeVisible({
      timeout: 10000,
    });

    // Verify the logged-in-only badge appears on the post
    await expect(
      page.locator('[title="Logged-in users only"]').first()
    ).toBeVisible({ timeout: 5000 });
  });
});
