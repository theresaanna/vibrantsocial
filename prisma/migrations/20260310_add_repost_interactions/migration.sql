-- CreateTable
CREATE TABLE "RepostLike" (
    "id" TEXT NOT NULL,
    "repostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepostBookmark" (
    "id" TEXT NOT NULL,
    "repostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepostBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepostComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "repostId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepostComment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "repostId" TEXT;

-- CreateIndex
CREATE INDEX "RepostLike_repostId_idx" ON "RepostLike"("repostId");

-- CreateIndex
CREATE UNIQUE INDEX "RepostLike_repostId_userId_key" ON "RepostLike"("repostId", "userId");

-- CreateIndex
CREATE INDEX "RepostBookmark_repostId_idx" ON "RepostBookmark"("repostId");

-- CreateIndex
CREATE UNIQUE INDEX "RepostBookmark_repostId_userId_key" ON "RepostBookmark"("repostId", "userId");

-- CreateIndex
CREATE INDEX "RepostComment_repostId_idx" ON "RepostComment"("repostId");

-- CreateIndex
CREATE INDEX "RepostComment_authorId_idx" ON "RepostComment"("authorId");

-- CreateIndex
CREATE INDEX "RepostComment_parentId_idx" ON "RepostComment"("parentId");

-- AddForeignKey
ALTER TABLE "RepostLike" ADD CONSTRAINT "RepostLike_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostLike" ADD CONSTRAINT "RepostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostBookmark" ADD CONSTRAINT "RepostBookmark_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostBookmark" ADD CONSTRAINT "RepostBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostComment" ADD CONSTRAINT "RepostComment_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostComment" ADD CONSTRAINT "RepostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepostComment" ADD CONSTRAINT "RepostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RepostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_repostId_fkey" FOREIGN KEY ("repostId") REFERENCES "Repost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
