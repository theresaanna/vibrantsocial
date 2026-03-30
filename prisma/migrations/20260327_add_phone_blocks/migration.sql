-- CreateTable
CREATE TABLE "PhoneBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneBlock_blockerId_phoneNumber_key" ON "PhoneBlock"("blockerId", "phoneNumber");

-- CreateIndex
CREATE INDEX "PhoneBlock_phoneNumber_idx" ON "PhoneBlock"("phoneNumber");
