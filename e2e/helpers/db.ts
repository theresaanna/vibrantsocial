import pg from "pg";
import bcrypt from "bcryptjs";

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
    const result = await pool.query(
      `INSERT INTO "User" (id, email, username, "passwordHash", "dateOfBirth", "phoneVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        id,
        TEST_USER.email,
        TEST_USER.username,
        passwordHash,
        TEST_USER.dateOfBirth.toISOString(),
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
    const result = await pool.query(
      `INSERT INTO "User" (id, email, username, "displayName", "passwordHash", "dateOfBirth", "phoneVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        id,
        TEST_USER_2.email,
        TEST_USER_2.username,
        TEST_USER_2.displayName,
        passwordHash,
        TEST_USER_2.dateOfBirth.toISOString(),
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
    await pool.query('UPDATE "User" SET tier = $1 WHERE email = $2', [
      tier,
      TEST_USER.email,
    ]);
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
    await pool.query(
      'UPDATE "User" SET "profileFrameId" = $1 WHERE email = $2',
      [frameId, TEST_USER.email]
    );
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
      { table: "Repost", column: "userId" },
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
