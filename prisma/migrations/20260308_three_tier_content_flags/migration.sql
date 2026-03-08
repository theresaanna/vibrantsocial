-- Step 1: Add isGraphicNudity column to Post
ALTER TABLE "Post" ADD COLUMN "isGraphicNudity" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate existing NSFW data to Graphic/Nudity
-- (All current NSFW-flagged posts become Graphic/Nudity posts)
UPDATE "Post" SET "isGraphicNudity" = "isNsfw";

-- Step 3: Reset isNsfw to false for all posts
-- (The new NSFW tier has different, more permissive semantics; no existing posts qualify)
UPDATE "Post" SET "isNsfw" = false;

-- Step 4: Rename showNsfwByDefault to showGraphicByDefault on User
ALTER TABLE "User" RENAME COLUMN "showNsfwByDefault" TO "showGraphicByDefault";

-- Step 5: Add showNsfwContent column to User (opt-in for new NSFW tier)
ALTER TABLE "User" ADD COLUMN "showNsfwContent" BOOLEAN NOT NULL DEFAULT false;
