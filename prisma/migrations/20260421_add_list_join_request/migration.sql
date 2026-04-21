-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "UserListJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LIST_JOIN_REQUEST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailOnListJoinRequest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserListJoinRequest" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserListJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserListJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserListJoinRequest_listId_status_idx" ON "UserListJoinRequest"("listId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserListJoinRequest_userId_idx" ON "UserListJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserListJoinRequest_listId_userId_key" ON "UserListJoinRequest"("listId", "userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserListJoinRequest" ADD CONSTRAINT "UserListJoinRequest_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserListJoinRequest" ADD CONSTRAINT "UserListJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
