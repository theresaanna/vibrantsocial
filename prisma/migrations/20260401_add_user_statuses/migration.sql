-- CreateTable
CREATE TABLE "UserStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(280) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserStatus_userId_createdAt_idx" ON "UserStatus"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserStatus" ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
