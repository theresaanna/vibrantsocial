-- AlterTable: DM messages
ALTER TABLE "Message" ADD COLUMN "mediaThumbUrl" TEXT;

-- AlterTable: chat room messages
ALTER TABLE "ChatRoomMessage" ADD COLUMN "mediaThumbUrl" TEXT;
