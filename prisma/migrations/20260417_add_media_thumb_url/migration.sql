-- Adds poster/thumbnail URL for video attachments. Used as the <video>
-- poster and as the target URL for the async NSFW image scan (since the
-- Python moderation service only decodes images).
--
-- Uses IF EXISTS because the ChatRoom* tables were historically created
-- via `prisma db push` rather than migrations, so fresh envs built from
-- migration history (e.g. CI) don't have them yet. This migration
-- no-ops on those envs and applies cleanly on prod/staging.
ALTER TABLE IF EXISTS "Message" ADD COLUMN IF NOT EXISTS "mediaThumbUrl" TEXT;
ALTER TABLE IF EXISTS "ChatRoomMessage" ADD COLUMN IF NOT EXISTS "mediaThumbUrl" TEXT;
