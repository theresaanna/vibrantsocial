-- CreateTable
CREATE TABLE "MarketplaceQuestion" (
    "id" TEXT NOT NULL,
    "marketplacePostId" TEXT NOT NULL,
    "askerId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceQuestion_marketplacePostId_createdAt_idx" ON "MarketplaceQuestion"("marketplacePostId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceQuestion_askerId_idx" ON "MarketplaceQuestion"("askerId");

-- AddForeignKey
ALTER TABLE "MarketplaceQuestion" ADD CONSTRAINT "MarketplaceQuestion_marketplacePostId_fkey" FOREIGN KEY ("marketplacePostId") REFERENCES "MarketplacePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceQuestion" ADD CONSTRAINT "MarketplaceQuestion_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
