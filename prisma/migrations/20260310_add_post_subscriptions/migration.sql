-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_POST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOnSubscribedPost" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PostSubscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "subscribedToId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostSubscription_subscriberId_idx" ON "PostSubscription"("subscriberId");

-- CreateIndex
CREATE INDEX "PostSubscription_subscribedToId_idx" ON "PostSubscription"("subscribedToId");

-- CreateIndex
CREATE UNIQUE INDEX "PostSubscription_subscriberId_subscribedToId_key" ON "PostSubscription"("subscriberId", "subscribedToId");

-- AddForeignKey
ALTER TABLE "PostSubscription" ADD CONSTRAINT "PostSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSubscription" ADD CONSTRAINT "PostSubscription_subscribedToId_fkey" FOREIGN KEY ("subscribedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
