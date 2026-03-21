import { test, expect } from "@playwright/test";
import { setTestUserTier, createFriendship, TEST_USER, TEST_USER_2 } from "../helpers/db";

test.describe("Custom Audience", () => {
  test.afterEach(async () => {
    // Reset tier to free after each test
    await setTestUserTier("free");
  });

  test("premium user sees Custom Audience button on compose page", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");

    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeVisible({ timeout: 10000 });
    await expect(button).toContainText("Custom Audience");
  });

  test("free user does not see Custom Audience button", async ({ page }) => {
    await setTestUserTier("free");
    await page.goto("/compose");

    // Wait for the page to load (Post button should be visible)
    await expect(page.locator('button:has-text("Post")')).toBeVisible({ timeout: 10000 });

    // Button is visible but disabled for free users
    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeDisabled();
  });

  test("premium user can open audience picker modal", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");

    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();

    // Modal should appear
    const modal = page.getByRole("dialog", { name: "Select custom audience" });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Search input should be in the modal
    await expect(page.getByTestId("audience-search")).toBeVisible();

    // Select All and Deselect All buttons should be present
    await expect(page.getByTestId("select-all")).toBeVisible();
    await expect(page.getByTestId("deselect-all")).toBeVisible();

    // Done button should be present
    await expect(page.getByTestId("audience-done")).toBeVisible();
  });

  test("audience picker shows friends when they exist", async ({ page }) => {
    await setTestUserTier("premium");
    // Create a friendship between test users
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto("/compose");

    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();

    // Wait for friends to load — the second test user should appear
    await expect(
      page.locator(`text=${TEST_USER_2.displayName}`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("can select a friend and see count on button", async ({ page }) => {
    await setTestUserTier("premium");
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto("/compose");

    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();

    // Wait for friends to load
    await expect(
      page.locator(`text=${TEST_USER_2.displayName}`)
    ).toBeVisible({ timeout: 10000 });

    // Click the checkbox for the friend
    const friendRow = page.locator(`label:has-text("${TEST_USER_2.displayName}")`);
    const checkbox = friendRow.locator('input[type="checkbox"]');
    await checkbox.click();

    // Close the picker
    await page.getByTestId("audience-done").click();

    // The button should show the count
    await expect(button).toContainText("Custom Audience (1)");
  });

  test("can search for friends in audience picker", async ({ page }) => {
    await setTestUserTier("premium");
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto("/compose");

    const button = page.getByTestId("custom-audience-button");
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();

    // Wait for friends to load
    await expect(
      page.locator(`text=${TEST_USER_2.displayName}`)
    ).toBeVisible({ timeout: 10000 });

    // Type in search
    const searchInput = page.getByTestId("audience-search");
    await searchInput.fill("nonexistent_user_xyz");

    // The friend should no longer be visible
    await expect(
      page.locator(`text=${TEST_USER_2.displayName}`)
    ).not.toBeVisible({ timeout: 3000 });

    // Clear search and friend reappears
    await searchInput.fill("");
    await expect(
      page.locator(`text=${TEST_USER_2.displayName}`)
    ).toBeVisible({ timeout: 3000 });
  });

  test("Custom Audience and Close Friends are mutually exclusive", async ({ page }) => {
    await setTestUserTier("premium");
    await page.goto("/compose");

    // Wait for UI
    const audienceBtn = page.getByTestId("custom-audience-button");
    await expect(audienceBtn).toBeVisible({ timeout: 10000 });

    // Enable Close Friends first
    const closeFriendsLabel = page.locator("label").filter({ hasText: "Close Friends" });
    await closeFriendsLabel.click();

    // The Close Friends checkbox should be checked
    const closeFriendsCheckbox = closeFriendsLabel.locator('input[type="checkbox"]');
    await expect(closeFriendsCheckbox).toBeChecked();

    // Click Custom Audience (opens picker, should uncheck close friends)
    await audienceBtn.click();

    // Close Friends should now be unchecked
    await expect(closeFriendsCheckbox).not.toBeChecked();
  });
});
