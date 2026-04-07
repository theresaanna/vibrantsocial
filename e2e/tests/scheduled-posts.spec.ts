import { test, expect } from "@playwright/test";
import { setTestUserTier, TEST_USER } from "../helpers/db";

// Tagged @slow so it's skipped by pre-push hook (--grep-invert "@slow")
test.describe("Scheduled Posts @slow", () => {
  test.afterEach(async () => {
    await setTestUserTier("free");
  });

  test("schedule toggle is disabled for free users", async ({ page }) => {
    await page.goto("/compose");
    const toggle = page.getByTestId("schedule-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeDisabled();
  });

  test("schedule toggle is enabled for premium users", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");
    const toggle = page.getByTestId("schedule-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();
  });

  test("premium user can open schedule picker", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");

    await page.getByTestId("schedule-toggle").click();
    const datetimePicker = page.getByTestId("schedule-datetime");
    await expect(datetimePicker).toBeVisible();
  });

  test("premium user can schedule a post", async ({ page }) => {
    await setTestUserTier("premium");
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
    const submitButton = page.getByRole("button", { name: "Schedule" });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Should see the scheduled post card on the compose page
    await expect(page.getByTestId("scheduled-post-card").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("premium user can see scheduled posts list", async ({ page }) => {
    await setTestUserTier("premium");
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
    await page.getByRole("button", { name: "Schedule" }).click();

    // Should see the scheduled posts section
    await expect(page.getByText("Scheduled Posts")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("scheduled-post-card").first()).toBeVisible();

    // Should see management buttons
    await expect(page.getByTestId("publish-now-button").first()).toBeVisible();
    await expect(page.getByTestId("edit-schedule-button").first()).toBeVisible();
    await expect(page.getByTestId("delete-scheduled-button").first()).toBeVisible();
  });

  test("premium user can delete a scheduled post", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");

    // Create a scheduled post
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(
      "A post that will be deleted before it publishes. Enough content here.",
      { delay: 10 }
    );
    await page.getByTestId("schedule-toggle").click();
    await page.getByTestId("schedule-datetime").fill("2099-03-01T08:00");
    await page.getByRole("button", { name: "Schedule" }).click();

    await expect(page.getByTestId("scheduled-post-card").first()).toBeVisible({
      timeout: 10000,
    });

    // Delete it
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("delete-scheduled-button").first().click();

    // The card should disappear (or the count change)
    await expect(page.getByText("A post that will be deleted")).toBeHidden({
      timeout: 10000,
    });
  });

  test("scheduled post does not appear in feed", async ({ page }) => {
    await setTestUserTier("premium");
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
    await page.getByRole("button", { name: "Schedule" }).click();

    await expect(page.getByTestId("scheduled-post-card").first()).toBeVisible({
      timeout: 10000,
    });

    // Navigate to feed and verify the post is NOT visible
    await page.goto("/feed");
    await expect(page.getByText(uniqueText)).toBeHidden();
  });

  test("free user sees premium badge on schedule section", async ({ page }) => {
    await page.goto("/compose");
    // The premium badge should be visible near the schedule toggle
    const premiumBadge = page.locator(
      '[data-testid="schedule-toggle"] + a [title="Premium feature"]'
    );
    await expect(premiumBadge).toBeVisible();
  });
});
