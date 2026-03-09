-- Add isPinned and editedAt columns to Repost
ALTER TABLE "Repost" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Repost" ADD COLUMN "editedAt" TIMESTAMP(3);
