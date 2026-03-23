-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_SIGNUP';
ALTER TYPE "NotificationType" ADD VALUE 'STARS_MILESTONE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "starsSpent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false;

-- Backfill referralCode for existing users
UPDATE "User" SET "referralCode" = gen_random_uuid()::text WHERE "referralCode" IS NULL;

-- Make referralCode required after backfill
ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
