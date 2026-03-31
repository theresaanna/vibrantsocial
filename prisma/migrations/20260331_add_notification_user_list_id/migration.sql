-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "userListId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userListId_fkey" FOREIGN KEY ("userListId") REFERENCES "UserList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
