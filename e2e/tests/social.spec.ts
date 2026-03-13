import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

test.describe("Social Interactions", () => {
  test("view own profile page", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}`);

    // Profile should show the username in the header
    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    // Profile stats section should be visible (e.g. "X posts")
    await expect(page.locator("text=/\\d+ posts/")).toBeVisible({
      timeout: 5000,
    });
  });

  test("create a post then like and unlike it", async ({ page }) => {
    // Create a post
    await page.goto("/compose");

    // Dismiss tag hint if visible
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    const postText = `Like test post ${Date.now()}`;
    await editor.pressSequentially(postText);
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Post should appear in the feed
    await expect(page.locator(`text=${postText}`)).toBeVisible({
      timeout: 10000,
    });

    // Like the post on the feed page
    const likeButton = page.locator('button[aria-label="Like"]').first();
    await expect(likeButton).toBeVisible({ timeout: 5000 });
    await likeButton.click();

    // Button should now show "Unlike"
    await expect(
      page.locator('button[aria-label="Unlike"]').first()
    ).toBeVisible({ timeout: 5000 });

    // Unlike it
    await page.locator('button[aria-label="Unlike"]').first().click();

    // Button should revert to "Like"
    await expect(
      page.locator('button[aria-label="Like"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("bookmark and unbookmark a post", async ({ page }) => {
    // Visit the feed — previous tests created posts so there should be content
    await page.goto("/feed");

    // Scroll past the compose editor to reveal feed posts
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const bookmarkButton = page
      .locator('button[aria-label="Bookmark"]')
      .first();
    const hasBookmark = await bookmarkButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasBookmark) {
      test.skip(true, "No posts to interact with");
      return;
    }

    await bookmarkButton.click();

    await expect(
      page.locator('button[aria-label="Unbookmark"]').first()
    ).toBeVisible({ timeout: 5000 });

    // Unbookmark
    await page
      .locator('button[aria-label="Unbookmark"]')
      .first()
      .click();

    await expect(
      page.locator('button[aria-label="Bookmark"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("share button copies link", async ({ page, context }) => {
    // Disable Web Share API so it falls through to clipboard copy
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
    });

    await page.goto("/feed");

    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const shareButton = page.locator('button[aria-label="Share"]').first();
    const hasShare = await shareButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasShare) {
      test.skip(true, "No posts to share");
      return;
    }

    await shareButton.click();

    // Should show "Copied!" text briefly
    await expect(page.locator("text=Copied!").first()).toBeVisible({
      timeout: 5000,
    });
  });
});
