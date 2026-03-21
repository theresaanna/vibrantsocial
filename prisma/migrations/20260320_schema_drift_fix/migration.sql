-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_MODERATION';

-- DropIndex
DROP INDEX IF EXISTS "User_phoneNumber_key";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "hasCustomAudience" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "isNsfw" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TagSubscription" ADD COLUMN     "emailNotification" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contentStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "premiumExpiresAt" TIMESTAMP(3),
ADD COLUMN     "profileBgAttachment" TEXT,
ADD COLUMN     "profileBgImage" TEXT,
ADD COLUMN     "profileBgPosition" TEXT,
ADD COLUMN     "profileBgRepeat" TEXT,
ADD COLUMN     "profileBgSize" TEXT,
ADD COLUMN     "sparklefallColors" TEXT,
ADD COLUMN     "sparklefallEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sparklefallInterval" INTEGER,
ADD COLUMN     "sparklefallMaxSize" INTEGER,
ADD COLUMN     "sparklefallMaxSparkles" INTEGER,
ADD COLUMN     "sparklefallMinSize" INTEGER,
ADD COLUMN     "sparklefallPreset" TEXT,
ADD COLUMN     "sparklefallSparkles" TEXT,
ADD COLUMN     "sparklefallWind" DOUBLE PRECISION,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "usernameFont" TEXT;

-- CreateTable
CREATE TABLE "ContentViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "action" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAudience" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentViolation_userId_idx" ON "ContentViolation"("userId");

-- CreateIndex
CREATE INDEX "ContentViolation_postId_idx" ON "ContentViolation"("postId");

-- CreateIndex
CREATE INDEX "PostAudience_postId_idx" ON "PostAudience"("postId");

-- CreateIndex
CREATE INDEX "PostAudience_userId_idx" ON "PostAudience"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostAudience_postId_userId_key" ON "PostAudience"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "ContentViolation" ADD CONSTRAINT "ContentViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentViolation" ADD CONSTRAINT "ContentViolation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
