-- Drop the strict unique constraint on (postId, userId)
DROP INDEX IF EXISTS "Repost_postId_userId_key";

-- Add a partial unique index that only applies to direct reposts (no quotedRepostId)
CREATE UNIQUE INDEX "Repost_postId_userId_direct_key" ON "Repost" ("postId", "userId") WHERE "quotedRepostId" IS NULL;

-- Add a regular index for general lookups
CREATE INDEX IF NOT EXISTS "Repost_postId_userId_idx" ON "Repost" ("postId", "userId");
