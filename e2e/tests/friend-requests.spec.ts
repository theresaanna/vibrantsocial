import { test, expect } from "../fixtures/auth";
import {
  TEST_USER,
  TEST_USER_2,
  seedTestUser,
  seedSecondTestUser,
  invalidateRelationshipCache,
} from "../helpers/db";
import pg from "pg";

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

async function cleanupFriendRequestsAndFollows() {
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

    // Invalidate cache for both users
    if (ids.length >= 2) {
      await invalidateRelationshipCache(ids[0], ids[1]);
    }
  } finally {
    await pool.end();
  }
}

async function createPendingFriendRequest(
  senderEmail: string,
  receiverEmail: string
) {
  const pool = createPool();
  try {
    const sender = await pool.query('SELECT id FROM "User" WHERE email = $1', [senderEmail]);
    const receiver = await pool.query('SELECT id FROM "User" WHERE email = $1', [receiverEmail]);
    if (!sender.rows[0] || !receiver.rows[0]) throw new Error("Users must exist");

    await pool.query(
      `INSERT INTO "FriendRequest" (id, "senderId", "receiverId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'PENDING', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [sender.rows[0].id, receiver.rows[0].id]
    );

    await invalidateRelationshipCache(sender.rows[0].id, receiver.rows[0].id);
  } finally {
    await pool.end();
  }
}

test.describe("Friend Requests Management @slow", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
    await cleanupFriendRequestsAndFollows();
  });

  test.afterAll(async () => {
    await cleanupFriendRequestsAndFollows();
  });

  // --- Friend Requests Page ---

  test("friend requests page is accessible", async ({ page, forceLogin }) => {
    await forceLogin;

    await page.goto("/friend-requests");
    await expect(page).toHaveURL(/\/friend-requests/);
    await expect(page.locator("h1", { hasText: "Friend Requests" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows empty state when no pending requests", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    await page.goto("/friend-requests");
    await page.waitForTimeout(2000);

    await expect(page.locator("text=/no pending friend requests/i")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows incoming friend request", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    // Create pending request from user 2 to user 1
    await createPendingFriendRequest(TEST_USER_2.email, TEST_USER.email);

    await page.goto("/friend-requests");
    await page.waitForTimeout(2000);

    // Should see user 2's name
    await expect(page.getByText(TEST_USER_2.username)).toBeVisible({ timeout: 10000 });

    // Should see Accept and Decline buttons
    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();
  });

  // --- Accept Friend Request ---

  test("can accept a friend request", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();
    await createPendingFriendRequest(TEST_USER_2.email, TEST_USER.email);

    await page.goto("/friend-requests");
    await page.waitForTimeout(2000);

    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Accept" }).click();

    // Should show success message
    await expect(page.locator("text=/now friends/i")).toBeVisible({ timeout: 10000 });
  });

  // --- Decline Friend Request ---

  test("can decline a friend request", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();
    await createPendingFriendRequest(TEST_USER_2.email, TEST_USER.email);

    await page.goto("/friend-requests");
    await page.waitForTimeout(2000);

    await expect(page.getByRole("button", { name: "Decline" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Decline" }).click();

    // Request should disappear
    await page.waitForTimeout(1000);
    await expect(page.locator("text=/no pending friend requests/i")).toBeVisible({
      timeout: 10000,
    });
  });

  // --- Send Friend Request from Profile ---

  test("can send friend request from profile page", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    const addFriendButton = page.getByRole("button", { name: "Add Friend" });
    await expect(addFriendButton).toBeVisible({ timeout: 5000 });
    await addFriendButton.click();

    // Button should change to Pending
    await expect(page.locator("text=Pending")).toBeVisible({ timeout: 10000 });
  });

  // --- Unfriend Flow ---

  test("can unfriend from profile page", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    // Create an accepted friendship
    const pool = createPool();
    try {
      const u1 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER.email]);
      const u2 = await pool.query('SELECT id FROM "User" WHERE email = $1', [TEST_USER_2.email]);
      await pool.query(
        `INSERT INTO "FriendRequest" (id, "senderId", "receiverId", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'ACCEPTED', NOW(), NOW())`,
        [u1.rows[0].id, u2.rows[0].id]
      );
      await invalidateRelationshipCache(u1.rows[0].id, u2.rows[0].id);
    } finally {
      await pool.end();
    }

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show Friends button
    const friendsButton = page.getByRole("button", { name: "Friends" });
    await expect(friendsButton).toBeVisible({ timeout: 10000 });
    await friendsButton.click();

    // Confirmation dialog should appear
    await expect(page.locator("text=/unfriend/i")).toBeVisible({ timeout: 5000 });

    // Confirm unfriend
    const unfriendConfirm = page.getByRole("button", { name: /unfriend/i }).last();
    await unfriendConfirm.click();

    // Should revert to Add Friend
    await expect(page.getByRole("button", { name: "Add Friend" })).toBeVisible({
      timeout: 10000,
    });
  });

  // --- Friend Request Button States ---

  test("pending request shows correct button state on profile", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    // Send request from test user 1 to test user 2
    await createPendingFriendRequest(TEST_USER.email, TEST_USER_2.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show Pending (not Add Friend)
    await expect(page.locator("text=Pending")).toBeVisible({ timeout: 10000 });
  });

  test("received request shows accept/decline on profile", async ({ page, forceLogin }) => {
    await forceLogin;
    await cleanupFriendRequestsAndFollows();

    // Send request from test user 2 to test user 1
    await createPendingFriendRequest(TEST_USER_2.email, TEST_USER.email);

    await page.goto(`/${TEST_USER_2.username}`);

    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Should show Accept and Decline buttons on the profile
    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();
  });
});
