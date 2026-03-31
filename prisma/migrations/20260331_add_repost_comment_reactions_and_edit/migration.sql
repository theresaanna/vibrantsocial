-- AlterTable: add editedAt to RepostComment
ALTER TABLE "RepostComment" ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateTable: RepostCommentReaction
CREATE TABLE "RepostCommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepostCommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepostCommentReaction_commentId_idx" ON "RepostCommentReaction"("commentId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "RepostCommentReaction_commentId_userId_emoji_key" ON "RepostCommentReaction"("commentId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "RepostCommentReaction" ADD CONSTRAINT "RepostCommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RepostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostCommentReaction" ADD CONSTRAINT "RepostCommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
