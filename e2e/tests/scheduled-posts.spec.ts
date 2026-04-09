import { test, expect } from "@playwright/test";
import { setTestUserTier, TEST_USER, seedTestUser } from "../helpers/db";
import pg from "pg";

/** Force a fresh login to pick up DB changes (e.g. tier) in the JWT */
async function freshLogin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(\/feed|\/complete-profile)/, { timeout: 15000 });
  if (page.url().includes("/complete-profile")) {
    await page.waitForURL("**/feed", { timeout: 30000 });
  }
  await page.evaluate(() => {
    localStorage.setItem("vibrantsocial-cookie-notice-dismissed", "true");
    localStorage.setItem("autotag-hint-dismissed", "1");
  });
}

async function deleteScheduledPosts() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `DELETE FROM "Post" WHERE "authorId" IN (SELECT id FROM "User" WHERE email = $1) AND "scheduledFor" IS NOT NULL`,
      [TEST_USER.email]
    );
  } finally {
    await pool.end();
  }
}

// Tagged @slow so it's skipped by pre-push hook (--grep-invert "@slow")
test.describe("Scheduled Posts @slow", () => {
  test.beforeEach(async () => {
    await deleteScheduledPosts();
  });

  test.afterEach(async () => {
    await setTestUserTier("free");
    await deleteScheduledPosts();
  });

  test("schedule toggle is disabled for free users", async ({ page }) => {
    await freshLogin(page);
    await page.goto("/compose");
    const toggle = page.getByTestId("schedule-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeDisabled();
  });

  test("schedule toggle is enabled for premium users", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");
    const toggle = page.getByTestId("schedule-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
  });

  test("premium user can open schedule picker", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    await page.getByTestId("schedule-toggle").click();
    const datetimePicker = page.getByTestId("schedule-datetime");
    await expect(datetimePicker).toBeVisible();
  });

  test("premium user can schedule a post", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    // Type content in the editor
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(
      "This is a scheduled test post with enough content to pass validation checks.",
      { delay: 10 }
    );

    // Open schedule picker and set a future date
    await page.getByTestId("schedule-toggle").click();
    const datetimePicker = page.getByTestId("schedule-datetime");
    await datetimePicker.fill("2099-12-31T23:59");

    // Submit button should say "Schedule"
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toHaveText("Schedule");
    await submitButton.click();

    // Should see the scheduled post card on the compose page
    await expect(page.getByTestId("scheduled-post-card")).toBeVisible({
      timeout: 10000,
    });
  });

  test("premium user can see scheduled posts list", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    // Type and schedule a post
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(
      "Another scheduled post for testing the scheduled posts list feature.",
      { delay: 10 }
    );
    await page.getByTestId("schedule-toggle").click();
    await page.getByTestId("schedule-datetime").fill("2099-06-15T10:00");
    await page.locator('button[type="submit"]').click();

    // Should see the scheduled posts section heading
    await expect(
      page.locator("h2", { hasText: "Scheduled Posts" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("scheduled-post-card")).toBeVisible();

    // Should see management buttons
    await expect(page.getByTestId("publish-now-button")).toBeVisible();
    await expect(page.getByTestId("edit-schedule-button")).toBeVisible();
    await expect(page.getByTestId("delete-scheduled-button")).toBeVisible();
  });

  test("premium user can delete a scheduled post", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    const uniqueDeleteText = `Delete-me-${Date.now()}`;

    // Create a scheduled post
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(
      `${uniqueDeleteText} Enough content here to pass validation.`,
      { delay: 10 }
    );
    await page.getByTestId("schedule-toggle").click();
    await page.getByTestId("schedule-datetime").fill("2099-03-01T08:00");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByTestId("scheduled-post-card")).toBeVisible({
      timeout: 10000,
    });

    // Delete it
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("delete-scheduled-button").click();

    // The card should disappear
    await expect(page.getByText(uniqueDeleteText)).toBeHidden({
      timeout: 10000,
    });
  });

  test("scheduled post does not appear in feed", async ({ page }) => {
    await setTestUserTier("premium");
    await freshLogin(page);
    await page.goto("/compose");

    // Schedule a post
    const uniqueText = `Scheduled-only-${Date.now()}`;
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(
      `${uniqueText} This is enough content to pass the validation check.`,
      { delay: 10 }
    );
    await page.getByTestId("schedule-toggle").click();
    await page.getByTestId("schedule-datetime").fill("2099-01-01T00:00");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByTestId("scheduled-post-card")).toBeVisible({
      timeout: 10000,
    });

    // Navigate to feed and verify the post is NOT visible
    await page.goto("/feed");
    await expect(page.getByText(uniqueText)).toBeHidden();
  });

  test("free user sees premium badge on schedule section", async ({ page }) => {
    await freshLogin(page);
    await page.goto("/compose");
    // The premium badge should be visible near the schedule toggle
    const premiumBadge = page.locator(
      '[data-testid="schedule-toggle"] + a [title="Premium feature"]'
    );
    await expect(premiumBadge).toBeVisible();
  });
});
