-- CreateEnum
CREATE TYPE "ShippingOption" AS ENUM ('FREE', 'FLAT_RATE', 'PICKUP_ONLY', 'CONTACT_SELLER');

-- CreateTable
CREATE TABLE "MarketplacePost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "purchaseUrl" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "shippingOption" "ShippingOption" NOT NULL DEFAULT 'CONTACT_SELLER',
    "shippingPrice" DOUBLE PRECISION,
    "promotedToFeed" BOOLEAN NOT NULL DEFAULT false,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePost_postId_key" ON "MarketplacePost"("postId");

-- CreateIndex
CREATE INDEX "MarketplacePost_postId_idx" ON "MarketplacePost"("postId");

-- AddForeignKey
ALTER TABLE "MarketplacePost" ADD CONSTRAINT "MarketplacePost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
