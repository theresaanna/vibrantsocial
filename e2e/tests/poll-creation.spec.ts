import { test, expect } from "@playwright/test";

test.describe("Poll Creation", () => {
  test("create a poll with a deadline via toolbar", async ({ page }) => {
    await page.goto("/compose");
    await expect(page).toHaveURL(/\/compose/);

    // Dismiss the tag suggestion hint if it appears
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    // Wait for the Lexical editor
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.waitForTimeout(300);

    // Click the Poll toolbar button
    const pollButton = page.getByRole("button", { name: "Poll" });
    await expect(pollButton).toBeVisible();
    await pollButton.click();

    // The modal should appear
    await expect(page.getByRole("heading", { name: "Insert Poll" })).toBeVisible({
      timeout: 5000,
    });

    // Fill in the question
    await page.locator('input[placeholder="Poll question"]').fill("What is best?");

    // Fill in options
    await page.locator('input[placeholder="Option 1"]').fill("Choice A");
    await page.locator('input[placeholder="Option 2"]').fill("Choice B");

    // Select a timeframe (1 hour)
    await page.getByRole("button", { name: "1 hour" }).click();

    // Click Insert Poll
    await page.getByRole("button", { name: "Insert Poll" }).click();

    // Verify poll appears in editor
    await expect(page.locator("text=What is best?")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Choice A")).toBeVisible();
    await expect(page.locator("text=Choice B")).toBeVisible();

    // Verify time remaining is shown
    await expect(page.locator("text=remaining")).toBeVisible();
  });

  test("create a poll without deadline", async ({ page }) => {
    await page.goto("/compose");

    // Dismiss any tooltips
    const gotItButton = page.getByRole("button", { name: "Got it" });
    if (await gotItButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItButton.click();
    }

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.waitForTimeout(300);

    const pollButton = page.getByRole("button", { name: "Poll" });
    await pollButton.click();

    await expect(page.getByRole("heading", { name: "Insert Poll" })).toBeVisible({
      timeout: 5000,
    });

    await page.locator('input[placeholder="Poll question"]').fill("No deadline poll");
    await page.locator('input[placeholder="Option 1"]').fill("Yes");
    await page.locator('input[placeholder="Option 2"]').fill("No");

    // Don't select any timeframe (default is no limit)
    await page.getByRole("button", { name: "Insert Poll" }).click();

    await expect(page.locator("text=No deadline poll")).toBeVisible({
      timeout: 5000,
    });
    // Should not show any time remaining text
    await expect(page.locator("text=remaining")).not.toBeVisible();
  });

  test("collapsible button is no longer in toolbar", async ({ page }) => {
    await page.goto("/compose");

    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });

    // The Collapsible button should not exist
    await expect(
      page.getByRole("button", { name: "Collapsible" })
    ).not.toBeVisible();
  });
});
