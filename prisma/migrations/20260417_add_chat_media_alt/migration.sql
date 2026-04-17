-- Adds alt text for image attachments in chatroom messages.
-- Uses IF EXISTS because ChatRoomMessage was historically created via
-- `prisma db push` on some envs (see 20260417_add_media_thumb_url).
ALTER TABLE IF EXISTS "ChatRoomMessage" ADD COLUMN IF NOT EXISTS "mediaAlt" TEXT;
