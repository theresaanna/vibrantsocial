-- AlterTable
ALTER TABLE "Repost" ADD COLUMN "quotedRepostId" TEXT;

-- AddForeignKey
ALTER TABLE "Repost" ADD CONSTRAINT "Repost_quotedRepostId_fkey" FOREIGN KEY ("quotedRepostId") REFERENCES "Repost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
