-- CreateTable
CREATE TABLE "LinkedAccountGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedAccountGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "linkedAccountGroupId" TEXT;

-- CreateIndex
CREATE INDEX "User_linkedAccountGroupId_idx" ON "User"("linkedAccountGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_linkedAccountGroupId_fkey" FOREIGN KEY ("linkedAccountGroupId") REFERENCES "LinkedAccountGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
