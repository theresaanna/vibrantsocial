-- CreateTable
CREATE TABLE IF NOT EXISTS "StatusLike" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StatusLike_statusId_userId_key" ON "StatusLike"("statusId", "userId");

-- AddForeignKey (idempotent: drop if exists, then create)
ALTER TABLE "StatusLike" DROP CONSTRAINT IF EXISTS "StatusLike_statusId_fkey";
ALTER TABLE "StatusLike" ADD CONSTRAINT "StatusLike_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "UserStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (idempotent: drop if exists, then create)
ALTER TABLE "StatusLike" DROP CONSTRAINT IF EXISTS "StatusLike_userId_fkey";
ALTER TABLE "StatusLike" ADD CONSTRAINT "StatusLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
