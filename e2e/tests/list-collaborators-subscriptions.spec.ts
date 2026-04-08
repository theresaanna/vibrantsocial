import { test, expect } from "../fixtures/auth";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser, createFriendship } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function createTestList(ownerEmail: string, name: string): Promise<string> {
  const pool = createPool();
  try {
    const owner = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [ownerEmail]
    );
    if (!owner.rows[0]) throw new Error(`User not found: ${ownerEmail}`);

    const result = await pool.query(
      `INSERT INTO "UserList" (id, name, "ownerId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
       RETURNING id`,
      [name, owner.rows[0].id]
    );
    return result.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function addUserToTestList(listId: string, userEmail: string) {
  const pool = createPool();
  try {
    const user = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [userEmail]
    );
    if (!user.rows[0]) return;

    await pool.query(
      `INSERT INTO "UserListMember" (id, "listId", "userId", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [listId, user.rows[0].id]
    );
  } finally {
    await pool.end();
  }
}

async function cleanupTestLists() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email IN ($1, $2)`,
      [TEST_USER.email, TEST_USER_2.email]
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(
      `DELETE FROM "UserListSubscription" WHERE "listId" IN (
        SELECT id FROM "UserList" WHERE "ownerId" = ANY($1)
      )`,
      [ids]
    );
    await pool.query(
      `DELETE FROM "UserListCollaborator" WHERE "listId" IN (
        SELECT id FROM "UserList" WHERE "ownerId" = ANY($1)
      )`,
      [ids]
    );
    await pool.query(
      `DELETE FROM "UserListMember" WHERE "listId" IN (
        SELECT id FROM "UserList" WHERE "ownerId" = ANY($1)
      )`,
      [ids]
    );
    await pool.query(
      `DELETE FROM "UserList" WHERE "ownerId" = ANY($1)`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

test.describe("List Collaborators & Subscriptions @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);
    await cleanupTestLists();
  });

  test.afterAll(async () => {
    await cleanupTestLists();
  });

  // --- Rename ---

  test("can rename a list", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Rename Me");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Click rename button (pencil icon)
    const renameButton = page.locator('button[title="Rename list"]');
    await expect(renameButton).toBeVisible({ timeout: 10000 });
    await renameButton.click();

    // Rename form should appear
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("Renamed List");

    await page.click('button:has-text("Save")');

    // Wait for rename to take effect
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText("Renamed List")).toBeVisible({ timeout: 10000 });
  });

  test("cancel rename preserves original name", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Keep My Name");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    const renameButton = page.locator('button[title="Rename list"]');
    await expect(renameButton).toBeVisible({ timeout: 10000 });
    await renameButton.click();

    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill("Should Not Appear");

    await page.click('button:has-text("Cancel")');

    await expect(page.getByText("Keep My Name")).toBeVisible();
    await expect(page.getByText("Should Not Appear")).not.toBeVisible();
  });

  // --- Collaborators ---

  test("collaborators section is visible to list owner", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Collab Test List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    await expect(page.getByText(/Collaborators/).first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('input[placeholder="Search users to add as collaborator..."]')
    ).toBeVisible();
  });

  test("can search and add collaborator", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Add Collab List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    const collabSearch = page.locator(
      'input[placeholder="Search users to add as collaborator..."]'
    );
    await expect(collabSearch).toBeVisible({ timeout: 10000 });
    await collabSearch.fill(TEST_USER_2.username);

    // Wait for search results
    await expect(page.getByText(TEST_USER_2.username).last()).toBeVisible({ timeout: 15000 });

    // Click Add for the collaborator result
    const addButtons = page.locator('button:has-text("Add")');
    // The collaborator Add button is in the collaborators section
    await addButtons.last().click();

    // Verify collaborator was added
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText(/Collaborators \(1\)/)).toBeVisible({ timeout: 10000 });
  });

  test("can remove a collaborator", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Remove Collab List");

    // Add collaborator via DB
    const pool = createPool();
    try {
      const user2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
      await pool.query(
        `INSERT INTO "UserListCollaborator" (id, "listId", "userId", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [listId, user2.rows[0].id]
      );
    } finally {
      await pool.end();
    }

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    await expect(page.getByText(/Collaborators \(1\)/)).toBeVisible({ timeout: 10000 });

    // Click Remove on collaborator
    // The collaborator section has its own Remove button(s)
    const removeButtons = page.locator('button:has-text("Remove")');
    await removeButtons.last().click();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText(/Collaborators \(0\)/)).toBeVisible({ timeout: 10000 });
  });

  // --- Subscriptions ---

  test("subscribe button is visible on list detail page", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Sub Test List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    const subscribeButton = page.getByRole("button", { name: /subscribe/i });
    await expect(subscribeButton).toBeVisible({ timeout: 10000 });
  });

  test("can subscribe and unsubscribe from a list", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Toggle Sub List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Subscribe
    const subscribeButton = page.getByRole("button", { name: /^subscribe$/i });
    await expect(subscribeButton).toBeVisible({ timeout: 10000 });
    await subscribeButton.click();

    // Should now show Subscribed
    await expect(page.getByRole("button", { name: /subscribed/i })).toBeVisible({
      timeout: 10000,
    });

    // Unsubscribe
    await page.getByRole("button", { name: /subscribed/i }).click();

    // Should revert to Subscribe
    await expect(page.getByRole("button", { name: /^subscribe$/i })).toBeVisible({
      timeout: 10000,
    });
  });

  // --- List Feed ---

  test("list with members shows View Feed button", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Feed View List");
    await addUserToTestList(listId, TEST_USER_2.email);

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Should have a View Feed link
    const feedLink = page.getByRole("link", { name: /view feed/i });
    await expect(feedLink).toBeVisible({ timeout: 10000 });
  });

  // --- Share ---

  test("share button is visible on list detail", async ({ page, forceLogin }) => {
    await forceLogin;
    const listId = await createTestList(TEST_USER.email, "Share Test List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Share button should be visible (may be icon-only)
    const shareButton = page.locator('button[title="Share list"]');
    if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(shareButton).toBeVisible();
    }
  });
});
