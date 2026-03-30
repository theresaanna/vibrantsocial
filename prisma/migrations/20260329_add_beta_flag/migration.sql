-- AlterTable
ALTER TABLE "User" ADD COLUMN "isBeta" BOOLEAN NOT NULL DEFAULT false;

-- Set beta access for specific users
UPDATE "User" SET "isBeta" = true WHERE "username" IN ('theresa', 'DeathAngel76');
