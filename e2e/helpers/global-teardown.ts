import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();
import { cleanupTestData, cleanupLinkedAccountGroups } from "./db";

export default async function globalTeardown() {
  await cleanupLinkedAccountGroups();
  await cleanupTestData();
}
