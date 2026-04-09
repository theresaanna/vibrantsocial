import { test, expect } from "../fixtures/auth";
import { TEST_USER, seedTestUser } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupLinksPage() {
  const pool = createPool();
  try {
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    if (!user.rows[0]) return;
    const userId = user.rows[0].id;

    await pool.query(`DELETE FROM "LinksPageLink" WHERE "userId" = $1`, [userId]);
    await pool.query(
      `UPDATE "User" SET "linksPageEnabled" = false, "linksPageBio" = NULL, "linksPageSensitiveLinks" = false WHERE id = $1`,
      [userId]
    );
  } finally {
    await pool.end();
  }
}

async function enableLinksPage() {
  const pool = createPool();
  try {
    await pool.query(
      `UPDATE "User" SET "linksPageEnabled" = true WHERE email = $1`,
      [TEST_USER.email]
    );
  } finally {
    await pool.end();
  }
}

async function seedLinks() {
  const pool = createPool();
  try {
    const user = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
    const userId = user.rows[0].id;

    await pool.query(
      `UPDATE "User" SET "linksPageEnabled" = true, "linksPageBio" = 'Test bio for links page' WHERE id = $1`,
      [userId]
    );

    await pool.query(
      `INSERT INTO "LinksPageLink" (id, "userId", title, url, "order")
       VALUES (gen_random_uuid(), $1, 'My Website', 'https://example.com', 0),
              (gen_random_uuid(), $1, 'My Blog', 'https://blog.example.com', 1)`,
      [userId]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Profile Links Page @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await cleanupLinksPage();
  });

  test.afterAll(async () => {
    await cleanupLinksPage();
  });

  // --- Settings Page ---

  test("links settings page is accessible", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/profile/links");
    await expect(page).toHaveURL(/\/profile\/links/);
    await expect(page.locator("text=/Links Page/i").first()).toBeVisible({ timeout: 10000 });
  });

  test("enable links page toggle works", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    const enableToggle = page.locator('input[name="linksPageEnabled"]');
    await expect(enableToggle).toBeVisible({ timeout: 10000 });

    // Toggle on
    if (!(await enableToggle.isChecked())) {
      await enableToggle.click();
    }
    await expect(enableToggle).toBeChecked();
  });

  test("can add and save links", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    // Enable the page
    const enableToggle = page.locator('input[name="linksPageEnabled"]');
    if (!(await enableToggle.isChecked())) {
      await enableToggle.click();
    }

    // Click Add Link
    await page.getByTestId("add-link-btn").click();

    // Fill in link fields
    const linkEntries = page.getByTestId("link-entry");
    const firstEntry = linkEntries.first();
    await firstEntry.locator('input[name="linkTitle"]').fill("My Website");
    await firstEntry.locator('input[name="linkUrl"]').fill("https://example.com");

    // Save
    await page.locator('button[type="submit"]').click();

    // Should show success message
    await expect(page.getByTestId("links-form-message")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("links-form-message")).toHaveClass(/text-green/);
  });

  test("can add multiple links", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinksPage();

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    const enableToggle = page.locator('input[name="linksPageEnabled"]');
    if (!(await enableToggle.isChecked())) {
      await enableToggle.click();
    }

    // Add first link
    await page.getByTestId("add-link-btn").click();
    const entries = page.getByTestId("link-entry");
    await entries.nth(0).locator('input[name="linkTitle"]').fill("Link One");
    await entries.nth(0).locator('input[name="linkUrl"]').fill("https://one.example.com");

    // Add second link
    await page.getByTestId("add-link-btn").click();
    await entries.nth(1).locator('input[name="linkTitle"]').fill("Link Two");
    await entries.nth(1).locator('input[name="linkUrl"]').fill("https://two.example.com");

    // Save
    await page.locator('button[type="submit"]').click();

    await expect(page.getByTestId("links-form-message")).toHaveClass(/text-green/, {
      timeout: 10000,
    });
  });

  test("can remove a link", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinksPage();
    await seedLinks();

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    const entryCount = await page.getByTestId("link-entry").count();
    expect(entryCount).toBeGreaterThanOrEqual(2);

    // Remove first link
    await page.getByTestId("remove-link-btn").first().click();

    // Should have one fewer entry
    const newCount = await page.getByTestId("link-entry").count();
    expect(newCount).toBe(entryCount - 1);
  });

  test("bio field accepts text", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    const bioField = page.locator('#linksPageBio');
    await expect(bioField).toBeVisible({ timeout: 10000 });

    await bioField.fill("This is my bio for the links page");

    // Save
    await page.locator('button[type="submit"]').click();
    await expect(page.getByTestId("links-form-message")).toHaveClass(/text-green/, {
      timeout: 10000,
    });
  });

  test("sensitive links toggle is available", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/profile/links");
    await page.waitForTimeout(2000);

    const sensitiveToggle = page.getByTestId("sensitive-links-toggle");
    await expect(sensitiveToggle).toBeVisible({ timeout: 10000 });
  });

  // --- Public Links Page ---

  test("public links page shows links when enabled", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinksPage();
    await seedLinks();

    await page.goto(`/links/${TEST_USER.username}`);
    await page.waitForTimeout(2000);

    // Should show the links
    const links = page.getByTestId("links-page-link");
    await expect(links.first()).toBeVisible({ timeout: 10000 });
    expect(await links.count()).toBeGreaterThanOrEqual(2);

    // Should show bio
    await expect(page.locator("text=Test bio for links page")).toBeVisible();
  });

  test("public links page returns 404 when disabled", async ({ page }) => {
    await cleanupLinksPage();

    const response = await page.goto(`/links/${TEST_USER.username}`);

    // Should get 404 or show not-found content
    if (response) {
      expect(response.status()).toBe(404);
    }
  });

  test("links open in new tab", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupLinksPage();
    await seedLinks();

    await page.goto(`/links/${TEST_USER.username}`);
    await page.waitForTimeout(2000);

    const link = page.getByTestId("links-page-link").first();
    await expect(link).toBeVisible({ timeout: 10000 });

    // Should have target="_blank"
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });
});
