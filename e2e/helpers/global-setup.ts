import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();
import { seedTestUser, seedSecondTestUser } from "./db";

export default async function globalSetup() {
  await seedTestUser();
  await seedSecondTestUser();
}
