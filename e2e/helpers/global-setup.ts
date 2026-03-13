import "dotenv/config";
import { seedTestUser } from "./db";

export default async function globalSetup() {
  await seedTestUser();
}
