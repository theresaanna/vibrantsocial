import { test, expect } from "../fixtures/auth";
import { TEST_USER } from "../helpers/db";
import pg from "pg";

async function setAgeVerified(email: string, verified: boolean) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `UPDATE "User" SET "ageVerified" = $1 WHERE email = $2`,
      [verified ? new Date() : null, email]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Age-gated content flags in composer", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test("non-age-verified user sees disabled Sensitive and Graphic/Explicit checkboxes", async ({
    page,
    forceLogin,
  }) => {
    void forceLogin;
    await setAgeVerified(TEST_USER.email, false);

    await page.goto("/compose");
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({
      timeout: 30000,
    });

    // Expand content warnings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const toggle = page.getByRole("button", { name: "Content Warnings" });
    await toggle.click();
    await page.waitForTimeout(300);

    // NSFW should be enabled
    const nsfwCheckbox = page.getByRole("checkbox", { name: "NSFW" });
    await expect(nsfwCheckbox).toBeVisible({ timeout: 5000 });
    await expect(nsfwCheckbox).toBeEnabled();

    // Should show "(verify age)" links for Sensitive and Graphic/Explicit
    const verifyLinks = page.getByText("(verify age)");
    await expect(verifyLinks).toHaveCount(2);

    // Sensitive and Graphic/Explicit checkboxes should be disabled
    const disabledCheckboxes = page.locator("input[type='checkbox'][disabled]");
    await expect(disabledCheckboxes).toHaveCount(2);
  });

  test("age-verified user can toggle Sensitive and Graphic/Explicit checkboxes", async ({
    page,
    forceLogin,
  }) => {
    void forceLogin;
    await setAgeVerified(TEST_USER.email, true);

    await page.goto("/compose");
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({
      timeout: 30000,
    });

    // Expand content warnings
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const toggle = page.getByRole("button", { name: "Content Warnings" });
    await toggle.click();
    await page.waitForTimeout(300);

    // All checkboxes should be enabled
    const sensitiveCheckbox = page.getByLabel("Sensitive");
    await expect(sensitiveCheckbox).toBeEnabled();
    await sensitiveCheckbox.check();
    await expect(sensitiveCheckbox).toBeChecked();

    const graphicCheckbox = page.getByLabel("Graphic/Explicit");
    await expect(graphicCheckbox).toBeEnabled();
    await graphicCheckbox.check();
    await expect(graphicCheckbox).toBeChecked();

    // No "(verify age)" links should be visible
    await expect(page.getByText("(verify age)")).toHaveCount(0);
  });

  test.afterAll(async () => {
    // Reset age verification state
    await setAgeVerified(TEST_USER.email, false);
  });
});
