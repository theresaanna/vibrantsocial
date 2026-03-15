import { test, expect } from "@playwright/test";
import { resetTestUserStars, getTestUserStars } from "../helpers/db";

/** Poll getTestUserStars until the predicate is true (or timeout). */
async function waitForStars(
  predicate: (stars: number) => boolean,
  timeoutMs = 5000,
  intervalMs = 250
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const stars = await getTestUserStars();
    if (predicate(stars)) return stars;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // Return the last value so the assertion can produce a clear error
  return getTestUserStars();
}

test.describe("Stars Points System", () => {
  test.beforeEach(async () => {
    await resetTestUserStars();
  });

  test("stars display is visible on profile page", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByTestId("stars-count")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("stars-count")).toContainText("stars");
  });

  test("creating a post increments stars and shows on profile", async ({
    page,
  }) => {
    await page.goto("/compose");

    // Dismiss tag hint if visible
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (
      await gotItButton
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await gotItButton.click();
    }

    // Create a post
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.click();
    await page.waitForTimeout(300);
    const postText = `Stars test post ${Date.now()}`;
    await editor.pressSequentially(postText);
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Verify stars incremented in DB (poll in case server action is still completing)
    const stars = await waitForStars((s) => s >= 1);
    expect(stars).toBe(1);

    // Navigate to profile and verify display
    await page.goto("/profile");
    await expect(page.getByTestId("stars-count")).toContainText("1 star");
  });

  test("liking a post increments stars", async ({ page }) => {
    await page.goto("/feed");

    const likeButton = page.locator('button[aria-label="Like"]').first();
    if (
      !(await likeButton.isVisible({ timeout: 5000 }).catch(() => false))
    ) {
      test.skip(true, "No posts to interact with");
      return;
    }
    await likeButton.click();
    await expect(
      page.locator('button[aria-label="Unlike"]').first()
    ).toBeVisible({ timeout: 5000 });

    // Poll DB — server action may still be completing
    const stars = await waitForStars((s) => s >= 1);
    expect(stars).toBeGreaterThanOrEqual(1);
  });

  test("unliking a post decrements stars", async ({ page }) => {
    await page.goto("/feed");

    const likeButton = page.locator('button[aria-label="Like"]').first();
    if (
      !(await likeButton.isVisible({ timeout: 5000 }).catch(() => false))
    ) {
      test.skip(true, "No posts to interact with");
      return;
    }

    // Like
    await likeButton.click();
    await expect(
      page.locator('button[aria-label="Unlike"]').first()
    ).toBeVisible({ timeout: 5000 });
    await waitForStars((s) => s >= 1);

    // Unlike
    await page.locator('button[aria-label="Unlike"]').first().click();
    await expect(
      page.locator('button[aria-label="Like"]').first()
    ).toBeVisible({ timeout: 5000 });

    // Poll DB — wait for decrement to land
    const stars = await waitForStars((s) => s === 0);
    expect(stars).toBe(0);
  });
});
