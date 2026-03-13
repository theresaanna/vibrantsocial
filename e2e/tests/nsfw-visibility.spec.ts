import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

test.describe("NSFW Content Visibility", () => {
  test.describe.configure({ mode: "serial" });

  let nsfwPostText: string;

  test("create an NSFW post and enable NSFW in settings", async ({ page }) => {
    // Enable NSFW in profile settings first
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });

    // Find and check the Show NSFW content checkbox
    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (!(await nsfwCheckbox.isChecked())) {
      await nsfwCheckbox.check();
      // Wait for autosave
      await page.waitForTimeout(2500);
    }

    // Create an NSFW post via compose page
    await page.goto("/compose");
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);

    nsfwPostText = `NSFW e2e test ${Date.now()}`;
    await editor.pressSequentially(nsfwPostText);

    // Expand Content Warnings and check NSFW
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(300);
    const toggle = page.getByRole("button", { name: "Content Warnings" });
    await toggle.click();
    await page.waitForTimeout(300);

    const nsfwLabel = page.getByLabel("NSFW");
    await expect(nsfwLabel).toBeVisible({ timeout: 5000 });
    await nsfwLabel.check();

    // Submit
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });
  });

  test("NSFW post appears in feed when NSFW is enabled", async ({ page }) => {
    await page.goto("/feed");
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 30000,
    });

    // Should show the NSFW badge
    await expect(
      page
        .locator(`article, [class*="rounded-2xl"]`, {
          has: page.locator(`text=${nsfwPostText}`),
        })
        .locator("text=NSFW")
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("NSFW post appears on profile posts tab when NSFW is enabled", async ({
    page,
  }) => {
    await page.goto(`/${TEST_USER.username}`);
    await expect(page.locator("text=Posts")).toBeVisible({ timeout: 10000 });

    // The NSFW post should be visible on the default "Posts" tab
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("NSFW post also appears on dedicated NSFW tab", async ({ page }) => {
    await page.goto(`/${TEST_USER.username}?tab=nsfw`);
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("NSFW post hidden from posts tab when NSFW is disabled", async ({
    page,
  }) => {
    // Disable NSFW in settings
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });

    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (await nsfwCheckbox.isChecked()) {
      await nsfwCheckbox.uncheck();
      // Wait for autosave
      await page.waitForTimeout(2500);
    }

    // Go to profile posts tab - NSFW post should NOT appear
    await page.goto(`/${TEST_USER.username}`);
    await expect(page.locator("text=Posts")).toBeVisible({ timeout: 10000 });

    // Wait for posts to load, then confirm NSFW post is not visible
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${nsfwPostText}`)).not.toBeVisible();
  });

  test("cleanup: re-enable NSFW for other tests", async ({ page }) => {
    // Re-enable NSFW so we leave the test user in a clean state
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 10000,
    });

    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (!(await nsfwCheckbox.isChecked())) {
      await nsfwCheckbox.check();
      await page.waitForTimeout(2500);
    }
  });
});
