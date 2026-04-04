import { test, expect } from "@playwright/test";

/**
 * Open the compose page with a clean editor (no drafts, no tooltips).
 */
async function openCompose(page: import("@playwright/test").Page) {
  await page.goto("/compose");
  await page.evaluate(() => {
    localStorage.setItem("autotag-hint-dismissed", "1");
    localStorage.removeItem("vibrant-draft:compose");
  });
  await page.reload();
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible({ timeout: 30000 });
  await editor.click();
  await page.waitForTimeout(300);
  return editor;
}

test.describe("Hashtag auto-tagging", () => {
  test("typing a hashtag in the editor auto-adds it to the tags field", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    // Type some text then a hashtag followed by a space (triggers HashtagLinkPlugin)
    await editor.pressSequentially("check this out #music ", { delay: 30 });

    // Wait for the hashtag to convert to a HashtagNode (link to /tag/music)
    await expect(editor.locator('a[href="/tag/music"]')).toBeVisible({
      timeout: 10000,
    });

    // The tag should appear as a pill in the tag input area
    const tagPill = page.locator("text=#music").first();
    await expect(tagPill).toBeVisible({ timeout: 5000 });
  });

  test("multiple hashtags in editor each appear in the tags field", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("#art is great and so is #gaming ", {
      delay: 30,
    });

    // Both hashtags should render as links
    await expect(editor.locator('a[href="/tag/art"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(editor.locator('a[href="/tag/gaming"]')).toBeVisible({
      timeout: 10000,
    });

    // Both should appear in the tags area
    const tagsHidden = page.locator('input[name="tags"]');
    await expect(tagsHidden).toHaveValue(/art/, { timeout: 5000 });
    await expect(tagsHidden).toHaveValue(/gaming/);
  });

  test("removing a hashtag from the editor removes it from tags", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("hello #removeme ", { delay: 30 });

    // Wait for hashtag to be converted and tag added
    await expect(editor.locator('a[href="/tag/removeme"]')).toBeVisible({
      timeout: 10000,
    });
    const tagsHidden = page.locator('input[name="tags"]');
    await expect(tagsHidden).toHaveValue(/removeme/, { timeout: 5000 });

    // Select all and delete
    await editor.press("Meta+a");
    await editor.press("Backspace");
    await page.waitForTimeout(500);

    // The tag should be removed
    await expect(tagsHidden).not.toHaveValue(/removeme/, { timeout: 5000 });
  });

  test("auto-tagged hashtag is submitted with the post and appears on tag page", async ({
    page,
  }) => {
    const editor = await openCompose(page);
    const uniqueTag = `autotag${Date.now()}`;
    const postText = `auto tag test ${Date.now()} `;

    await editor.pressSequentially(`${postText}#${uniqueTag} `, { delay: 30 });

    // Wait for the hashtag node to appear
    await expect(
      editor.locator(`a[href="/tag/${uniqueTag}"]`)
    ).toBeVisible({ timeout: 10000 });

    // Verify the hidden tags input includes the auto-tagged value
    const tagsHidden = page.locator('input[name="tags"]');
    await expect(tagsHidden).toHaveValue(new RegExp(uniqueTag), {
      timeout: 5000,
    });

    // Submit the post
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Verify the post appears in the feed
    await expect(page.locator(`text=${postText.trim()}`).first()).toBeVisible({
      timeout: 10000,
    });

    // Navigate to the tag page and verify the post shows up
    await page.goto(`/tag/${uniqueTag}`);
    await expect(page.locator(`text=${postText.trim()}`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("manually added tags are preserved alongside auto-tagged hashtags", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    // First add a manual tag
    const tagInput = page.getByTestId("tag-input");
    await tagInput.click();
    await tagInput.fill("manualtag");
    await page.keyboard.press("Enter");

    // Now type a hashtag in the editor
    await editor.click();
    await editor.pressSequentially("post with #editortag ", { delay: 30 });

    await expect(editor.locator('a[href="/tag/editortag"]')).toBeVisible({
      timeout: 10000,
    });

    // Both tags should be present in the hidden input
    const tagsHidden = page.locator('input[name="tags"]');
    await expect(tagsHidden).toHaveValue(/manualtag/, { timeout: 5000 });
    await expect(tagsHidden).toHaveValue(/editortag/);
  });
});
