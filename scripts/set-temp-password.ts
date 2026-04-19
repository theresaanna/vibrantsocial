import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: tsx scripts/set-temp-password.ts <username>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pw = "Vs-" + crypto.randomBytes(12).toString("base64url");
  const hash = await bcrypt.hash(pw, 12);

  const client = new Client({ connectionString: url });
  await client.connect();
  const res = await client.query(
    `UPDATE "User" SET "passwordHash" = $1 WHERE "username" = $2 RETURNING "id", "email", "username"`,
    [hash, username],
  );
  await client.end();

  if (res.rowCount === 0) {
    console.error(`No user found with username '${username}'`);
    process.exit(1);
  }
  console.log("Updated:", res.rows[0]);
  console.log("TEMP_PASSWORD=" + pw);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
