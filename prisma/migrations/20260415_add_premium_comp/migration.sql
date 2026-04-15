-- CreateTable
CREATE TABLE "PremiumComp" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "previousTrialEnd" TIMESTAMP(3),
    "newTrialEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumComp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremiumComp_userId_idx" ON "PremiumComp"("userId");

-- CreateIndex
CREATE INDEX "PremiumComp_adminId_idx" ON "PremiumComp"("adminId");

-- CreateIndex
CREATE INDEX "PremiumComp_createdAt_idx" ON "PremiumComp"("createdAt");

-- AddForeignKey
ALTER TABLE "PremiumComp" ADD CONSTRAINT "PremiumComp_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumComp" ADD CONSTRAINT "PremiumComp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
