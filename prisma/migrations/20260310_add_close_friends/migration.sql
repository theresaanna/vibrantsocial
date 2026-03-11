-- AlterTable
ALTER TABLE "Post" ADD COLUMN "isCloseFriendsOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Repost" ADD COLUMN "isCloseFriendsOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CloseFriend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloseFriend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CloseFriend_userId_idx" ON "CloseFriend"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CloseFriend_userId_friendId_key" ON "CloseFriend"("userId", "friendId");

-- AddForeignKey
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
