-- CreateEnum
CREATE TYPE "UserListJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LIST_JOIN_REQUEST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOnListJoinRequest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserListJoinRequest" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserListJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserListJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserListJoinRequest_listId_status_idx" ON "UserListJoinRequest"("listId", "status");

-- CreateIndex
CREATE INDEX "UserListJoinRequest_userId_idx" ON "UserListJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserListJoinRequest_listId_userId_key" ON "UserListJoinRequest"("listId", "userId");

-- AddForeignKey
ALTER TABLE "UserListJoinRequest" ADD CONSTRAINT "UserListJoinRequest_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListJoinRequest" ADD CONSTRAINT "UserListJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
