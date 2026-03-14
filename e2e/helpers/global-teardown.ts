import "dotenv/config";
import { cleanupTestData, cleanupLinkedAccountGroups } from "./db";

export default async function globalTeardown() {
  await cleanupLinkedAccountGroups();
  await cleanupTestData();
}
