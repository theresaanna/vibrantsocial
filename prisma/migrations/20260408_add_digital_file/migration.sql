-- CreateTable
CREATE TABLE "DigitalFile" (
    "id" TEXT NOT NULL,
    "marketplacePostId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "couponCode" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigitalFile_marketplacePostId_key" ON "DigitalFile"("marketplacePostId");

-- CreateIndex
CREATE INDEX "DigitalFile_marketplacePostId_idx" ON "DigitalFile"("marketplacePostId");

-- AddForeignKey
ALTER TABLE "DigitalFile" ADD CONSTRAINT "DigitalFile_marketplacePostId_fkey" FOREIGN KEY ("marketplacePostId") REFERENCES "MarketplacePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
