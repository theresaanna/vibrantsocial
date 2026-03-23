import { test, expect } from "@playwright/test";

test.describe("Post Slug URLs", () => {
  test("create a post and verify slug URL works", async ({ page }) => {
    await page.goto("/compose");

    // Dismiss the tag suggestion hint if it appears
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    const postText = `Slug test post ${Date.now()}`;
    await editor.pressSequentially(postText);

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Verify the post appears in the feed
    await expect(page.locator(`text=${postText}`)).toBeVisible({
      timeout: 10000,
    });

    // Click on the timestamp link to navigate to the post page
    const postCard = page
      .locator(`text=${postText}`)
      .first()
      .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')]");
    const timestampLink = postCard.locator("a").filter({ hasText: /ago|just now/ }).first();
    await timestampLink.click();

    // Should be on the slug URL: /{username}/post/{slug}
    await expect(page).toHaveURL(/\/[a-z0-9_]+\/post\/[a-z0-9-]+/, {
      timeout: 10000,
    });

    // Verify the post content is visible
    await expect(page.locator(`text=${postText}`)).toBeVisible();
  });

  test("post with custom slug uses that slug in URL", async ({ page }) => {
    await page.goto("/compose");

    // Dismiss the tag suggestion hint if it appears
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    await editor.pressSequentially(
      "Custom slug test post with enough content to pass validation"
    );

    // Scroll down and open the Custom URL section
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);

    const customUrlToggle = page.getByRole("button", { name: "Custom URL" });
    await expect(customUrlToggle).toBeVisible({ timeout: 5000 });
    await customUrlToggle.click();

    // Enter a custom slug
    const slugInput = page.locator('input[name="slug"]');
    await expect(slugInput).toBeVisible({ timeout: 5000 });
    const customSlug = `e2e-custom-${Date.now()}`;
    await slugInput.fill(customSlug);

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Navigate to the post and verify custom slug is in URL
    await expect(
      page.locator("text=Custom slug test post")
    ).toBeVisible({ timeout: 10000 });

    const postCard = page
      .locator("text=Custom slug test post")
      .first()
      .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')]");
    const timestampLink = postCard.locator("a").filter({ hasText: /ago|just now/ }).first();
    await timestampLink.click();

    // URL should contain the custom slug
    await expect(page).toHaveURL(new RegExp(customSlug), {
      timeout: 10000,
    });
  });

  test("compose page shows Custom URL toggle", async ({ page }) => {
    test.fixme();
    await page.goto("/compose");

    const customUrlToggle = page.getByRole("button", { name: "Custom URL" });
    await expect(customUrlToggle).toBeVisible({ timeout: 10000 });

    // Click to expand
    await customUrlToggle.click();

    // Slug input should appear
    const slugInput = page.locator('input[name="slug"]');
    await expect(slugInput).toBeVisible({ timeout: 5000 });
    await expect(slugInput).toHaveAttribute("placeholder", "my-post-title");

    // Click to collapse
    await customUrlToggle.click();

    // Slug input should be hidden
    await expect(slugInput).not.toBeVisible({ timeout: 5000 });
  });
});
