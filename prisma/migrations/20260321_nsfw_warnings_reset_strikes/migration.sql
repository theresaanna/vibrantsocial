-- AlterTable
ALTER TABLE "User" ADD COLUMN "contentWarnings" INTEGER NOT NULL DEFAULT 0;

-- Reset all existing NSFW strikes (switching to warning-first system)
UPDATE "User" SET "contentStrikes" = 0;
