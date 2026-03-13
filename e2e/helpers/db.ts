import pg from "pg";
import bcrypt from "bcryptjs";

export const TEST_USER = {
  email: "e2e-test@example.com",
  username: "e2e_testuser",
  password: "TestPassword123!",
  dateOfBirth: new Date("2001-01-15"),
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

export async function cleanupTestData() {
  const pool = createPool();
  try {
    // Find test user IDs
    const users = await pool.query(
      `SELECT id FROM "User" WHERE email LIKE 'e2e-%'`
    );
    const ids = users.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) return;

    // Delete in dependency order
    const tables = [
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
