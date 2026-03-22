import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers/db";

/**
 * Helper: dismiss the cookie consent toast if it appears.
 * In CI, localStorage is not preserved between tests, so the
 * Sonner toast (duration: Infinity) shows on every page load.
 */
async function dismissCookieToast(page: import("@playwright/test").Page) {
  const closeToast = page.getByRole("button", { name: "Close toast" });
  if (await closeToast.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeToast.click();
  }
}

/**
 * Helper: save profile settings and wait for the server action to complete.
 * Uses waitForResponse instead of relying on the transient "Saved" status text,
 * which only displays for 2 seconds and is prone to timing issues in CI.
 */
async function saveProfileSettings(page: import("@playwright/test").Page) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.request().method() === "POST" && resp.url().includes("/profile"),
    { timeout: 15000 }
  );
  await page.click('button:has-text("Save")');
  await responsePromise;
  // Brief wait for React state to settle after the server action completes
  await page.waitForTimeout(500);
}

test.describe("NSFW Content Visibility", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let nsfwPostText: string;

  test("create an NSFW post and enable NSFW in settings", async ({ page }) => {
    test.fixme();
    // Enable NSFW in profile settings first
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 15000,
    });

    await dismissCookieToast(page);

    // Find and check the Show NSFW content checkbox
    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (!(await nsfwCheckbox.isChecked())) {
      await nsfwCheckbox.check();
    }

    // Save and wait for the server action to complete
    await saveProfileSettings(page);

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

    // Submit and wait for redirect to feed
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 45000 });

    // Verify the post appeared on the feed right after creation
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 30000,
    });
  });

  test("NSFW post appears in feed when NSFW is enabled", async ({ page }) => {
    test.fixme();
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
    test.fixme();
    await page.goto(`/${TEST_USER.username}`);
    await expect(page.getByRole("link", { name: "Posts", exact: true })).toBeVisible({ timeout: 15000 });

    // The NSFW post should be visible on the default "Posts" tab
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test("NSFW post also appears on dedicated NSFW tab", async ({ page }) => {
    test.fixme();
    await page.goto(`/${TEST_USER.username}?tab=nsfw`);
    await expect(page.locator(`text=${nsfwPostText}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test("NSFW post hidden from posts tab when NSFW is disabled", async ({
    page,
  }) => {
    test.fixme();
    // Disable NSFW in settings
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 15000,
    });

    await dismissCookieToast(page);

    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (await nsfwCheckbox.isChecked()) {
      await nsfwCheckbox.uncheck();
    }

    // Save and wait for the server action to complete
    await saveProfileSettings(page);

    // Go to profile posts tab - NSFW post should NOT appear
    await page.goto(`/${TEST_USER.username}`);
    await expect(page.getByRole("link", { name: "Posts", exact: true })).toBeVisible({ timeout: 15000 });

    // Wait for posts to load, then confirm NSFW post is not visible
    await page.waitForTimeout(2000);
    await expect(page.locator(`text=${nsfwPostText}`)).not.toBeVisible();
  });

  test("cleanup: re-enable NSFW for other tests", async ({ page }) => {
    test.fixme();
    // Re-enable NSFW so we leave the test user in a clean state
    await page.goto("/profile");
    await expect(page.locator('input[name="username"]')).toBeVisible({
      timeout: 15000,
    });

    await dismissCookieToast(page);

    const nsfwCheckbox = page.locator('input[name="showNsfwContent"]');
    await nsfwCheckbox.scrollIntoViewIfNeeded();

    if (!(await nsfwCheckbox.isChecked())) {
      await nsfwCheckbox.check();
    }

    await saveProfileSettings(page);
  });
});
