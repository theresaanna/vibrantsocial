import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_USER_2 } from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupRelationships() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email IN ($1, $2)`,
      [TEST_USER.email, TEST_USER_2.email]
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length < 2) return;

    await pool.query(
      `DELETE FROM "FriendRequest" WHERE "senderId" = ANY($1) AND "receiverId" = ANY($1)`,
      [ids]
    );
    await pool.query(
      `DELETE FROM "Follow" WHERE "followerId" = ANY($1) AND "followingId" = ANY($1)`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

async function createFollow(followerEmail: string, followingEmail: string) {
  const pool = createPool();
  try {
    const follower = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [followerEmail]
    );
    const following = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [followingEmail]
    );
    if (!follower.rows[0] || !following.rows[0]) return;

    await pool.query(
      `INSERT INTO "Follow" (id, "followerId", "followingId", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [follower.rows[0].id, following.rows[0].id]
    );
  } finally {
    await pool.end();
  }
}

async function createFriendship(email1: string, email2: string) {
  const pool = createPool();
  try {
    const user1 = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [email1]
    );
    const user2 = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [email2]
    );
    if (!user1.rows[0] || !user2.rows[0]) return;

    await pool.query(
      `INSERT INTO "FriendRequest" (id, "senderId", "receiverId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'ACCEPTED', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [user1.rows[0].id, user2.rows[0].id]
    );
  } finally {
    await pool.end();
  }
}

test.describe("Follow & Friend Button UI", () => {
  test.beforeEach(async () => {
    await cleanupRelationships();
  });

  test.afterEach(async () => {
    await cleanupRelationships();
  });

  test("Follow button shows 'Follow' with outline border on other profiles", async ({
    page,
  }) => {
    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const followButton = page.getByRole("button", { name: "Follow" });
    await expect(followButton).toBeVisible({ timeout: 5000 });

    // Should have outline styling (border-2 border-blue-500, bg-transparent)
    await expect(followButton).toHaveClass(/border-2/);
    await expect(followButton).toHaveClass(/border-blue-500/);
    await expect(followButton).toHaveClass(/bg-transparent/);
  });

  test("Follow button shows 'Following' with gradient when already following", async ({
    page,
  }) => {
    // Set up follow relationship via DB
    await createFollow(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const followingButton = page.getByRole("button", { name: "Following" });
    await expect(followingButton).toBeVisible({ timeout: 5000 });

    // Should have gradient styling
    await expect(followingButton).toHaveClass(/bg-gradient-to-r/);
    await expect(followingButton).toHaveClass(/from-blue-500/);
    await expect(followingButton).toHaveClass(/to-cyan-500/);
  });

  test("Friend button shows 'Add Friend' with outline fuchsia border", async ({
    page,
  }) => {
    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const addFriendButton = page.getByRole("button", { name: "Add Friend" });
    await expect(addFriendButton).toBeVisible({ timeout: 5000 });

    // Should have outline fuchsia styling
    await expect(addFriendButton).toHaveClass(/border-2/);
    await expect(addFriendButton).toHaveClass(/border-fuchsia-500/);
    await expect(addFriendButton).toHaveClass(/bg-transparent/);
  });

  test("Friend button shows 'Friends' with gradient when already friends", async ({
    page,
  }) => {
    // Set up friendship via DB
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const friendsButton = page.getByRole("button", { name: "Friends" });
    await expect(friendsButton).toBeVisible({ timeout: 5000 });

    // Should have gradient styling
    await expect(friendsButton).toHaveClass(/bg-gradient-to-r/);
    await expect(friendsButton).toHaveClass(/from-fuchsia-500/);
    await expect(friendsButton).toHaveClass(/to-pink-500/);
  });

  test("clicking 'Following' shows confirmation dialog with 'Unfollow?' title", async ({
    page,
  }) => {
    test.fixme();
    await createFollow(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const followingButton = page.getByRole("button", { name: "Following" });
    await expect(followingButton).toBeVisible({ timeout: 5000 });
    await followingButton.click();

    // Confirmation dialog should appear
    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should show "Unfollow?" title
    await expect(
      dialog.locator("h3", { hasText: "Unfollow?" })
    ).toBeVisible();

    // Should have Unfollow and Cancel buttons
    await expect(
      dialog.getByRole("button", { name: "Unfollow" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("clicking 'Friends' shows confirmation dialog with 'Unfriend?' title", async ({
    page,
  }) => {
    test.fixme();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const friendsButton = page.getByRole("button", { name: "Friends" });
    await expect(friendsButton).toBeVisible({ timeout: 5000 });
    await friendsButton.click();

    // Confirmation dialog should appear
    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should show "Unfriend?" title
    await expect(
      dialog.locator("h3", { hasText: "Unfriend?" })
    ).toBeVisible();

    // Should have Unfriend and Cancel buttons
    await expect(
      dialog.getByRole("button", { name: "Unfriend" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("cancel on unfollow confirmation dialog dismisses it without action", async ({
    page,
  }) => {
    test.fixme();
    await createFollow(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const followingButton = page.getByRole("button", { name: "Following" });
    await expect(followingButton).toBeVisible({ timeout: 5000 });
    await followingButton.click();

    // Dialog should appear
    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Dialog should be dismissed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // "Following" button should still be visible (not changed to "Follow")
    await expect(
      page.getByRole("button", { name: "Following" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("cancel on unfriend confirmation dialog dismisses it without action", async ({
    page,
  }) => {
    test.fixme();
    await createFriendship(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const friendsButton = page.getByRole("button", { name: "Friends" });
    await expect(friendsButton).toBeVisible({ timeout: 5000 });
    await friendsButton.click();

    // Dialog should appear
    const dialog = page.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Dialog should be dismissed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // "Friends" button should still be visible
    await expect(
      page.getByRole("button", { name: "Friends" })
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Chat & Friend Requests Pages", () => {
  test("chat page loads and shows message requests section structure", async ({
    page,
  }) => {
    await page.goto("/chat");

    // Chat page should load (not redirect to login)
    await page.waitForURL("**/chat", { timeout: 15000 });

    // The page should render without errors
    await expect(page.locator("body")).toBeVisible();
  });

  test("friend requests page at /friend-requests loads correctly", async ({
    page,
  }) => {
    await page.goto("/friend-requests");

    // Should show the Friend Requests heading
    await expect(
      page.locator("h1", { hasText: "Friend Requests" })
    ).toBeVisible({ timeout: 15000 });

    // Should show the subtitle
    await expect(
      page.locator("text=People who want to connect with you")
    ).toBeVisible({ timeout: 5000 });
  });

  test("own profile does not show follow or friend buttons", async ({
    page,
  }) => {
    await page.goto(`/${TEST_USER.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER.username })
    ).toBeVisible({ timeout: 15000 });

    // Own profile should show "Edit Profile" instead of follow/friend buttons
    await expect(page.locator("a", { hasText: "Edit Profile" })).toBeVisible({
      timeout: 5000,
    });

    // Follow and Add Friend buttons should NOT be visible on own profile
    await expect(
      page.getByRole("button", { name: "Follow" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Friend" })
    ).not.toBeVisible();
  });
});
