/**
 * Seeds chat rooms owned by `theresa`. Idempotent — edit ROOMS and re-run.
 * Run: npx tsx scripts/seed-chat-rooms.ts (from repo root)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ROOMS = [
  { slug: "findom", name: "Findom", isNsfw: true },
  { slug: "spicy-vibrant", name: "Spicy Vibrant", isNsfw: true },
  { slug: "music-chat", name: "Music Chat", isNsfw: false },
  { slug: "nerd-talk", name: "Nerd Talk", isNsfw: false },
];

async function main() {
  const owner = await prisma.user.findFirst({
    where: { username: "theresa" },
    select: { id: true },
  });
  if (!owner) throw new Error("Default room owner (theresa) not found");

  for (const room of ROOMS) {
    const result = await prisma.chatRoom.upsert({
      where: { slug: room.slug },
      update: { name: room.name, isNsfw: room.isNsfw },
      create: { slug: room.slug, name: room.name, isNsfw: room.isNsfw, ownerId: owner.id },
      select: { slug: true, name: true, isNsfw: true },
    });
    console.log(`✓ ${result.name} (${result.slug}) — NSFW: ${result.isNsfw}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
