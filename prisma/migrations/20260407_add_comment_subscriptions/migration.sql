-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIBED_COMMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOnSubscribedComment" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CommentSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentSubscription_userId_postId_key" ON "CommentSubscription"("userId", "postId");

-- CreateIndex
CREATE INDEX "CommentSubscription_postId_idx" ON "CommentSubscription"("postId");

-- CreateIndex
CREATE INDEX "CommentSubscription_userId_idx" ON "CommentSubscription"("userId");

-- AddForeignKey
ALTER TABLE "CommentSubscription" ADD CONSTRAINT "CommentSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentSubscription" ADD CONSTRAINT "CommentSubscription_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
