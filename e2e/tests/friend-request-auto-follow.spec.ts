import { test, expect } from "@playwright/test";
import { TEST_USER, TEST_USER_2, seedTestUser, seedSecondTestUser } from "../helpers/db";
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
  } finally {
    await pool.end();
  }
}

async function getFollowExists(
  senderEmail: string,
  receiverEmail: string
): Promise<boolean> {
  const pool = createPool();
  try {
    const sender = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [senderEmail]
    );
    const receiver = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [receiverEmail]
    );
    if (!sender.rows[0] || !receiver.rows[0]) return false;

    const result = await pool.query(
      `SELECT id FROM "Follow" WHERE "followerId" = $1 AND "followingId" = $2`,
      [sender.rows[0].id, receiver.rows[0].id]
    );
    return result.rows.length > 0;
  } finally {
    await pool.end();
  }
}

test.describe("Friend Request Auto-Follow", () => {
  test.beforeAll(async () => {
    await seedTestUser();
    await seedSecondTestUser();
  });

  test.beforeEach(async () => {
    await cleanupFriendRequestsAndFollows();
  });

  test.afterEach(async () => {
    await cleanupFriendRequestsAndFollows();
  });

  test("sending a friend request automatically follows the target user", async ({
    page,
  }) => {
    // Verify no follow exists initially
    const followBefore = await getFollowExists(
      TEST_USER.email,
      TEST_USER_2.email
    );
    expect(followBefore).toBe(false);

    // Navigate to the second test user's profile
    await page.goto(`/${TEST_USER_2.username}`);

    // Wait for profile to load
    await expect(
      page.locator("h1", { hasText: TEST_USER_2.displayName })
    ).toBeVisible({ timeout: 15000 });

    // Click "Add Friend" button
    const addFriendButton = page.getByRole("button", { name: "Add Friend" });
    await expect(addFriendButton).toBeVisible({ timeout: 5000 });
    await addFriendButton.click();

    // Wait for the button to change to "Pending"
    await expect(
      page.locator("text=Pending")
    ).toBeVisible({ timeout: 10000 });

    // Verify follow was created in the database
    const followAfter = await getFollowExists(
      TEST_USER.email,
      TEST_USER_2.email
    );
    expect(followAfter).toBe(true);
  });
});
