-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WALL_POST';

-- CreateTable
CREATE TABLE "WallPost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "wallOwnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WallPost_postId_key" ON "WallPost"("postId");

-- CreateIndex
CREATE INDEX "WallPost_wallOwnerId_status_idx" ON "WallPost"("wallOwnerId", "status");

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_wallOwnerId_fkey" FOREIGN KEY ("wallOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
