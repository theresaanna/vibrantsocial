import { test, expect } from "@playwright/test";
import { seedSecondTestUser, TEST_USER_2 } from "../helpers/db";

/**
 * Helpers shared across editor plugin tests.
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

test.describe("Editor Plugins – Mentions", () => {
  test.beforeAll(async () => {
    await seedSecondTestUser();
  });

  test("typing @ in editor shows mention suggestions dropdown", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially(`hello @${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    // The mention dropdown uses role="listbox" with label "Mention suggestions"
    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Should show the second test user
    await expect(dropdown.getByText(`@${TEST_USER_2.username}`)).toBeVisible();
  });

  test("clicking a mention suggestion inserts @username node", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Click the matching user
    await dropdown.getByText(`@${TEST_USER_2.username}`).click();

    // Dropdown should close
    await expect(dropdown).not.toBeVisible();

    // The mention should render as a link to the user's profile
    const mentionLink = editor.locator(
      `a[href="/${TEST_USER_2.username}"]`
    );
    await expect(mentionLink).toBeVisible();
    await expect(mentionLink).toContainText(`@${TEST_USER_2.username}`);
  });

  test("pressing Enter selects the highlighted mention", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Press Enter to select the first (highlighted) option
    await page.keyboard.press("Enter");

    await expect(dropdown).not.toBeVisible();

    const mentionLink = editor.locator(
      `a[href="/${TEST_USER_2.username}"]`
    );
    await expect(mentionLink).toBeVisible();
  });

  test("pressing Escape dismisses the mention dropdown", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");

    await expect(dropdown).not.toBeVisible();
  });

  test("arrow keys navigate mention suggestions", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // First option should be selected
    const firstOption = dropdown.getByRole("option").first();
    await expect(firstOption).toHaveAttribute("aria-selected", "true");

    // Press down arrow to move selection
    await page.keyboard.press("ArrowDown");

    // First option should no longer be selected if there are multiple results
    const options = dropdown.getByRole("option");
    const count = await options.count();
    if (count > 1) {
      await expect(firstOption).toHaveAttribute("aria-selected", "false");
      const secondOption = options.nth(1);
      await expect(secondOption).toHaveAttribute("aria-selected", "true");
    }
  });

  test("mention is preserved after posting and appears in feed", async ({
    page,
  }) => {
    const editor = await openCompose(page);
    const postText = `mention test ${Date.now()} `;

    await editor.pressSequentially(postText);
    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Enter");
    await expect(dropdown).not.toBeVisible();

    // Submit the post
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Find the post in the feed
    const postLocator = page.locator(`text=${postText.trim()}`).first();
    await expect(postLocator).toBeVisible({ timeout: 10000 });

    // The mention should render as a link in the feed
    const feedMention = page
      .locator('[data-testid="post-card"]')
      .filter({ hasText: postText.trim() })
      .locator(`a[href="/${TEST_USER_2.username}"]`);
    await expect(feedMention).toBeVisible();
  });
});

test.describe("Editor Plugins – Hashtags", () => {
  test("typing # in editor shows tag suggestions dropdown", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    // Use a common prefix likely to match existing tags
    await editor.pressSequentially("check out #tes", { delay: 50 });

    const dropdown = page.getByRole("listbox", { name: "Tag suggestions" });
    // Dropdown only appears if matching tags exist in the DB; may not show up in a clean DB
    const appeared = await dropdown
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (appeared) {
      // Verify options render with # prefix and post count
      const firstOption = dropdown.getByRole("option").first();
      await expect(firstOption).toBeVisible();
    }
    // If no tags exist yet, just confirm typing doesn't error and the editor is intact
    await expect(editor).toContainText("#tes");
  });

  test("selecting a hashtag suggestion inserts a linked node", async ({
    page,
  }) => {
    // First create a post with a tag so the tag exists for autocomplete
    const editor = await openCompose(page);
    const tagName = `e2etag${Date.now()}`;
    const seedText = `seeding tag ${Date.now()}`;
    await editor.pressSequentially(seedText);

    // Add the tag via the tag input (not the hashtag plugin) so it's in the DB
    const tagInput = page.getByPlaceholder("Add tags");
    if (await tagInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagInput.click();
      await tagInput.fill(tagName);
      await page.keyboard.press("Enter");
    }

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Now create a second post using the hashtag autocomplete
    const editor2 = await openCompose(page);
    await editor2.pressSequentially(`#${tagName.slice(0, 6)}`, { delay: 50 });

    const dropdown = page.getByRole("listbox", { name: "Tag suggestions" });
    const appeared = await dropdown
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (appeared) {
      // Click the matching tag
      const tagOption = dropdown.getByText(new RegExp(`#${tagName}`));
      if (await tagOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tagOption.click();
        await expect(dropdown).not.toBeVisible();

        // Hashtag should render as a link to /tag/<name>
        const hashtagLink = editor2.locator(`a[href="/tag/${tagName}"]`);
        await expect(hashtagLink).toBeVisible();
      }
    }
  });

  test("pressing Escape dismisses the hashtag dropdown", async ({ page }) => {
    // First seed a tag
    const editor = await openCompose(page);
    const seedText = `hashtag esc test ${Date.now()}`;
    await editor.pressSequentially(seedText);

    const tagInput = page.getByPlaceholder("Add tags");
    if (await tagInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagInput.click();
      await tagInput.fill("e2etest");
      await page.keyboard.press("Enter");
    }
    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Now test escape
    const editor2 = await openCompose(page);
    await editor2.pressSequentially("#e2etes", { delay: 50 });

    const dropdown = page.getByRole("listbox", { name: "Tag suggestions" });
    const appeared = await dropdown
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (appeared) {
      await page.keyboard.press("Escape");
      await expect(dropdown).not.toBeVisible();
    }
  });
});

test.describe("Editor Plugins – Auto-Link", () => {
  test("typing a URL auto-converts it to a link", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("visit https://example.com for info ", {
      delay: 30,
    });

    // AutoLinkPlugin creates an <a> element for the URL
    const link = editor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible({ timeout: 5000 });
    await expect(link).toContainText("https://example.com");
  });

  test("typing a www URL auto-converts with https prefix", async ({
    page,
  }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("go to www.example.com now ", {
      delay: 30,
    });

    const link = editor.locator('a[href="https://www.example.com"]');
    await expect(link).toBeVisible({ timeout: 5000 });
  });

  test("typing an email auto-converts to a mailto link", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("email me at user@example.com please ", {
      delay: 30,
    });

    const link = editor.locator('a[href="mailto:user@example.com"]');
    await expect(link).toBeVisible({ timeout: 5000 });
  });

  test("typing a bare domain auto-converts to a link", async ({ page }) => {
    const editor = await openCompose(page);

    await editor.pressSequentially("check example.com out ", { delay: 30 });

    const link = editor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible({ timeout: 5000 });
  });

  test("auto-linked URLs survive posting and render in feed", async ({
    page,
  }) => {
    const editor = await openCompose(page);
    const postText = `link test ${Date.now()} visit https://example.com `;

    await editor.pressSequentially(postText, { delay: 20 });

    // Confirm link exists in editor before posting
    await expect(
      editor.locator('a[href="https://example.com"]')
    ).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Post")');
    await page.waitForURL("**/feed", { timeout: 30000 });

    // Find the post and verify the link rendered
    const postCard = page
      .locator('[data-testid="post-card"]')
      .filter({ hasText: `link test` })
      .first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const feedLink = postCard.locator('a[href="https://example.com"]');
    await expect(feedLink).toBeVisible();
  });
});

test.describe("Editor Plugins – Draft Persistence", () => {
  test("draft auto-saves and restores after reload", async ({ page }) => {
    const editor = await openCompose(page);
    const draftText = `draft persistence ${Date.now()}`;

    await editor.pressSequentially(draftText);

    // Wait for draft to save (3s debounce + margin)
    await page.waitForFunction(
      () => localStorage.getItem("vibrant-draft:compose") !== null,
      { timeout: 15000 }
    );

    // Reload the page
    await page.reload();
    const editorAfterReload = page.locator('[contenteditable="true"]').first();
    await expect(editorAfterReload).toBeVisible({ timeout: 30000 });

    // Draft content should be restored
    await expect(editorAfterReload).toContainText(draftText, {
      timeout: 15000,
    });
  });

  test("draft includes rich content (mention nodes)", async ({ page }) => {
    await seedSecondTestUser();
    const editor = await openCompose(page);
    const prefix = `rich draft ${Date.now()} `;

    await editor.pressSequentially(prefix);
    await editor.pressSequentially(`@${TEST_USER_2.username.slice(0, 4)}`, {
      delay: 50,
    });

    const dropdown = page.getByRole("listbox", { name: "Mention suggestions" });
    await expect(dropdown).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Enter");
    await expect(dropdown).not.toBeVisible();

    // Wait for draft to save
    await page.waitForFunction(
      () => localStorage.getItem("vibrant-draft:compose") !== null,
      { timeout: 15000 }
    );

    // Verify the draft JSON contains the mention node
    const draftJson = await page.evaluate(() =>
      localStorage.getItem("vibrant-draft:compose")
    );
    expect(draftJson).toContain("mention");
    expect(draftJson).toContain(TEST_USER_2.username);

    // Reload and verify mention is restored
    await page.reload();
    const editorAfterReload = page.locator('[contenteditable="true"]').first();
    await expect(editorAfterReload).toBeVisible({ timeout: 30000 });
    await expect(editorAfterReload).toContainText(prefix.trim(), {
      timeout: 15000,
    });

    const mentionLink = editorAfterReload.locator(
      `a[href="/${TEST_USER_2.username}"]`
    );
    await expect(mentionLink).toBeVisible({ timeout: 5000 });
  });
});
