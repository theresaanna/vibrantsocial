import pg from "pg";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

/**
 * Invalidate friendship/follow/block-related cache keys between two users.
 * Call this after directly modifying Follow/FriendRequest/Block tables in tests.
 */
export async function invalidateRelationshipCache(userId1: string, userId2: string) {
  const redis = getRedis();
  if (!redis) return;
  const [a, b] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  await Promise.all([
    redis.del(`friendship:${a}:${b}`),
    redis.del(`user:${userId1}:profile`),
    redis.del(`user:${userId2}:profile`),
    redis.del(`user:${userId1}:blocked`),
    redis.del(`user:${userId2}:blocked`),
    redis.del(`user:${userId1}:blocked-by`),
    redis.del(`user:${userId2}:blocked-by`),
    redis.del(`user:${userId1}:all-blocks`),
    redis.del(`user:${userId2}:all-blocks`),
    redis.del(`user:${userId1}:following`),
    redis.del(`user:${userId2}:following`),
  ]);
}

export const TEST_USER = {
  email: "e2e-test@example.com",
  username: "e2e_testuser",
  password: "TestPassword123!",
  dateOfBirth: new Date("2001-01-15"),
};

export const TEST_USER_2 = {
  email: "e2e-test2@example.com",
  username: "e2e_testuser2",
  displayName: "E2E User Two",
  password: "TestPassword456!",
  dateOfBirth: new Date("2000-06-15"),
};

function createPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

export async function seedTestUser() {
  const pool = createPool();
  try {
    const existing = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const passwordHash = await bcrypt.hash(TEST_USER.password, 12);
    const id = "e2e_" + Date.now().toString(36);
    const referralCode = "e2e_ref_" + Date.now().toString(36);
    const result = await pool.query(
      `INSERT INTO "User" (id, email, username, "passwordHash", "dateOfBirth", "phoneVerified", "referralCode", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW(), NOW())
       RETURNING id`,
      [
        id,
        TEST_USER.email,
        TEST_USER.username,
        passwordHash,
        TEST_USER.dateOfBirth.toISOString(),
        referralCode,
      ]
    );
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

export async function seedSecondTestUser() {
  const pool = createPool();
  try {
    const existing = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [TEST_USER_2.email]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const passwordHash = await bcrypt.hash(TEST_USER_2.password, 12);
    const id = "e2e2_" + Date.now().toString(36);
    const referralCode2 = "e2e_ref2_" + Date.now().toString(36);
    const result = await pool.query(
      `INSERT INTO "User" (id, email, username, "displayName", "passwordHash", "dateOfBirth", "phoneVerified", "referralCode", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW(), NOW())
       RETURNING id`,
      [
        id,
        TEST_USER_2.email,
        TEST_USER_2.username,
        TEST_USER_2.displayName,
        passwordHash,
        TEST_USER_2.dateOfBirth.toISOString(),
        referralCode2,
      ]
    );
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

export async function setTestUserTier(tier: "free" | "premium") {
  const pool = createPool();
  try {
    const result = await pool.query(
      'UPDATE "User" SET tier = $1 WHERE email = $2 RETURNING id',
      [tier, TEST_USER.email]
    );
    const userId = result.rows[0]?.id;
    if (userId) {
      const redis = getRedis();
      if (redis) await redis.del(`user:${userId}:profile`);
    }
  } finally {
    await pool.end();
  }
}

export async function getTestUserStars(): Promise<number> {
  const pool = createPool();
  try {
    const result = await pool.query(
      'SELECT stars FROM "User" WHERE email = $1',
      [TEST_USER.email]
    );
    return result.rows[0]?.stars ?? 0;
  } finally {
    await pool.end();
  }
}

export async function resetTestUserStars() {
  const pool = createPool();
  try {
    await pool.query('UPDATE "User" SET stars = 0 WHERE email = $1', [
      TEST_USER.email,
    ]);
  } finally {
    await pool.end();
  }
}

export async function setTestUserFrame(frameId: string | null) {
  const pool = createPool();
  try {
    const result = await pool.query(
      'UPDATE "User" SET "profileFrameId" = $1 WHERE email = $2 RETURNING id',
      [frameId, TEST_USER.email]
    );
    const userId = result.rows[0]?.id;
    if (userId) {
      const redis = getRedis();
      if (redis) await redis.del(`user:${userId}:profile`);
    }
  } finally {
    await pool.end();
  }
}

export async function setTestUserFont(fontId: string | null) {
  const pool = createPool();
  try {
    const result = await pool.query(
      'UPDATE "User" SET "usernameFont" = $1 WHERE email = $2 RETURNING id',
      [fontId, TEST_USER.email]
    );
    const userId = result.rows[0]?.id;
    if (userId) {
      const redis = getRedis();
      if (redis) await redis.del(`user:${userId}:profile`);
    }
  } finally {
    await pool.end();
  }
}

export async function cleanupLinkedAccountGroups() {
  const pool = createPool();
  try {
    // Unlink all test users from any groups
    await pool.query(
      `UPDATE "User" SET "linkedAccountGroupId" = NULL WHERE email LIKE 'e2e-%'`
    );
    // Delete orphaned groups (no members)
    await pool.query(
      `DELETE FROM "LinkedAccountGroup" WHERE id NOT IN (
        SELECT DISTINCT "linkedAccountGroupId" FROM "User" WHERE "linkedAccountGroupId" IS NOT NULL
      )`
    );
  } finally {
    await pool.end();
  }
}

export async function linkTestAccounts() {
  const pool = createPool();
  try {
    // Get both test user IDs
    const users = await pool.query(
      `SELECT id, email FROM "User" WHERE email IN ($1, $2)`,
      [TEST_USER.email, TEST_USER_2.email]
    );
    if (users.rows.length < 2) throw new Error("Both test users must exist");

    // Create a linked account group
    const group = await pool.query(
      `INSERT INTO "LinkedAccountGroup" (id) VALUES (gen_random_uuid()) RETURNING id`
    );
    const groupId = group.rows[0].id;

    // Link both users to the group
    const ids = users.rows.map((r: { id: string }) => r.id);
    await pool.query(
      `UPDATE "User" SET "linkedAccountGroupId" = $1 WHERE id = ANY($2)`,
      [groupId, ids]
    );
  } finally {
    await pool.end();
  }
}

export async function createTestNotifications(
  targetEmail: string,
  actorEmail: string,
  count: number
) {
  const pool = createPool();
  try {
    const target = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [targetEmail]
    );
    const actor = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [actorEmail]
    );
    if (!target.rows[0] || !actor.rows[0])
      throw new Error("Users must exist");

    const targetId = target.rows[0].id;
    const actorId = actor.rows[0].id;

    for (let i = 0; i < count; i++) {
      await pool.query(
        `INSERT INTO "Notification" (id, type, "actorId", "targetUserId", "createdAt")
         VALUES (gen_random_uuid(), 'FOLLOW', $1, $2, NOW())`,
        [actorId, targetId]
      );
    }
  } finally {
    await pool.end();
  }
}

export async function cleanupTestNotifications() {
  const pool = createPool();
  try {
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    await pool.query(
      `DELETE FROM "Notification" WHERE "targetUserId" = ANY($1) OR "actorId" = ANY($1)`,
      [ids]
    );
  } finally {
    await pool.end();
  }
}

export async function createFriendship(email1: string, email2: string) {
  const pool = createPool();
  try {
    const user1 = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [email1]
    );
    const user2 = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [email2]
    );
    if (!user1.rows[0] || !user2.rows[0])
      throw new Error("Both users must exist");

    const senderId = user1.rows[0].id;
    const receiverId = user2.rows[0].id;

    // Check if friendship already exists
    const existing = await pool.query(
      `SELECT id FROM "FriendRequest" WHERE
        (("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $2 AND "receiverId" = $1))
        AND status = 'ACCEPTED'`,
      [senderId, receiverId]
    );
    if (existing.rows.length > 0) return;

    await pool.query(
      `INSERT INTO "FriendRequest" (id, "senderId", "receiverId", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'ACCEPTED', NOW(), NOW())`,
      [senderId, receiverId]
    );
    await invalidateRelationshipCache(senderId, receiverId);
  } finally {
    await pool.end();
  }
}

export async function cleanupTestData() {
  const pool = createPool();
  try {
    // Find test user IDs
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    // Unlink from account groups first
    await pool.query(
      `UPDATE "User" SET "linkedAccountGroupId" = NULL WHERE id = ANY($1)`,
      [ids]
    );

    // Delete in dependency order
    const tables = [
      { table: "CommentReaction", column: "userId" },
      { table: "Like", column: "userId" },
      { table: "Bookmark", column: "userId" },
      { table: "Comment", column: "authorId" },
      { table: "PostAudience", column: "userId" },
      { table: "Repost", column: "userId" },
      { table: "CloseFriend", column: "userId" },
      { table: "Post", column: "authorId" },
      { table: "Notification", column: "targetUserId" },
      { table: "Notification", column: "actorId" },
      { table: "Follow", column: "followerId" },
      { table: "Follow", column: "followingId" },
      { table: "FriendRequest", column: "senderId" },
      { table: "FriendRequest", column: "receiverId" },
      { table: "Session", column: "userId" },
      { table: "Account", column: "userId" },
    ];

    for (const { table, column } of tables) {
      await pool.query(
        `DELETE FROM "${table}" WHERE "${column}" = ANY($1)`,
        [ids]
      );
    }

    await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  } finally {
    await pool.end();
  }
}
