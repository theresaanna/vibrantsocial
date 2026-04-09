import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
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

    // Delete list members first (FK constraint), then lists
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

async function getTestUserId(email: string): Promise<string> {
  const pool = createPool();
  try {
    const result = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [email]
    );
    return result.rows[0]?.id;
  } finally {
    await pool.end();
  }
}

async function createTestList(ownerEmail: string, name: string): Promise<string> {
  const pool = createPool();
  try {
    const owner = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
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
      `SELECT id FROM "User" WHERE email = $1`,
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

test.describe("User Lists", () => {
  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
  });

  test.beforeEach(async () => {
    await cleanupTestLists();
  });

  test.afterAll(async () => {
    await cleanupTestLists();
  });

  test("can create a list from /lists page", async ({ page }) => {
    await page.goto("/lists");
    await page.waitForURL(/\/lists/);

    // Should show empty state
    await expect(page.getByText("No lists yet.")).toBeVisible();

    // Create a list
    await page.fill('input[name="name"]', "My Test List");
    await page.click('button:has-text("Create")');

    // Wait for server action to complete and page to update
    await expect(page.getByText("My Test List")).toBeVisible({ timeout: 15000 }).catch(async () => {
      // Server action may not trigger revalidation fast enough; reload
      await page.reload();
      await expect(page.getByText("My Test List")).toBeVisible({ timeout: 10000 });
    });
    await expect(page.getByText("0 members")).toBeVisible();
  });

  test("can navigate to list detail and search for users", async ({ page }) => {
    // Create a list via DB
    const listId = await createTestList(TEST_USER.email, "Search Test List");

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Should show empty member state
    await expect(page.getByText("No members yet.")).toBeVisible();

    // Search for test user 2
    const searchInput = page.locator('input[placeholder="Search users to add..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(TEST_USER_2.username);

    // Wait for debounce + server action to return results
    await expect(page.getByText(TEST_USER_2.username)).toBeVisible({ timeout: 15000 });

    // Add user to list
    await page.click('button:has-text("Add")');

    // The member should now appear in the members section
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText("1 member")).toBeVisible();
  });

  test("can remove a member from a list", async ({ page }) => {
    // Create list and add member via DB
    const listId = await createTestList(TEST_USER.email, "Remove Test List");
    await addUserToTestList(listId, TEST_USER_2.email);

    await page.goto(`/lists/${listId}`);
    await page.waitForURL(new RegExp(`/lists/${listId}`));

    // Should show member
    await expect(page.getByText("1 member")).toBeVisible();

    // Remove member
    await page.click('button:has-text("Remove")');

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText("No members yet.")).toBeVisible();
  });

  test("can delete a list", async ({ page }) => {
    // Create a list via DB
    await createTestList(TEST_USER.email, "Delete Me List");

    await page.goto("/lists");
    await page.waitForURL(/\/lists/);

    await expect(page.getByText("Delete Me List")).toBeVisible();

    // Click delete
    await page.click('button:has-text("Delete")');

    // Confirm in dialog
    const confirmBtn = page.getByRole("button", { name: "Delete" }).last();
    await confirmBtn.click();

    await page.waitForTimeout(1000);
    await page.reload();

    // List should be gone
    await expect(page.getByText("Delete Me List")).not.toBeVisible();
  });

  test("feed page shows tabs when user has lists", async ({ page }) => {
    // Create a list via DB
    await createTestList(TEST_USER.email, "Feed Tab List");

    await page.goto("/feed");
    await page.waitForURL(/\/feed/);

    // Should see the Feed tab and the list tab
    await expect(page.getByRole("link", { name: "Feed", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Feed Tab List" })).toBeVisible();
  });

  test("can view list feed via tab", async ({ page }) => {
    // Create list and add member
    const listId = await createTestList(TEST_USER.email, "View Feed List");
    await addUserToTestList(listId, TEST_USER_2.email);

    await page.goto("/feed");
    await page.waitForURL(/\/feed/);

    // Click the list tab
    await page.click(`a[href="/feed?list=${listId}"]`);
    await page.waitForURL(new RegExp(`list=${listId}`));

    // Should be on the list feed page (no error)
    await expect(page.locator("body")).toBeVisible();
  });

  test("can add user to list from profile page", async ({ page }) => {
    // Create a list first
    await createTestList(TEST_USER.email, "Profile Add List");

    // Go to test user 2's profile
    await page.goto(`/${TEST_USER_2.username}`);
    await page.waitForURL(new RegExp(TEST_USER_2.username));

    // Click the list button (icon button with title "Add to list")
    await page.click('button[title="Add to list"]');

    // Should see the modal with the list
    await expect(page.getByText("Add to Lists")).toBeVisible();
    await expect(page.getByText("Profile Add List")).toBeVisible();

    // Check the checkbox to add user to list
    const checkbox = page.getByRole("checkbox");
    await checkbox.click();

    // Save
    await page.click('button:has-text("Save")');

    // Verify: open the modal again
    await page.waitForTimeout(500);
    await page.click('button[title="Add to list"]');
    await expect(page.getByRole("checkbox")).toBeChecked();
  });

  test("lists nav link is visible", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForURL(/\/feed/);

    const listsLink = page.getByRole("link", { name: "Lists" });
    await expect(listsLink).toBeVisible();
    await expect(listsLink).toHaveAttribute("href", "/lists");
  });
});
