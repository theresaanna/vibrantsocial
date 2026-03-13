import "dotenv/config";
import { cleanupTestData } from "./db";

export default async function globalTeardown() {
  await cleanupTestData();
}
