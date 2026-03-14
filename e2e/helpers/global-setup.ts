import "dotenv/config";
import { seedTestUser, seedSecondTestUser } from "./db";

export default async function globalSetup() {
  await seedTestUser();
  await seedSecondTestUser();
}
