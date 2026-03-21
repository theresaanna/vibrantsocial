-- AlterEnum (idempotent: check if value exists first)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONTENT_MODERATION' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_MODERATION';
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "User_phoneNumber_key";

-- AlterTable (use IF NOT EXISTS for each column)
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "hasCustomAudience" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "isNsfw" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TagSubscription" ADD COLUMN IF NOT EXISTS "emailNotification" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "contentStrikes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "premiumExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "profileBgAttachment" TEXT,
ADD COLUMN IF NOT EXISTS "profileBgImage" TEXT,
ADD COLUMN IF NOT EXISTS "profileBgPosition" TEXT,
ADD COLUMN IF NOT EXISTS "profileBgRepeat" TEXT,
ADD COLUMN IF NOT EXISTS "profileBgSize" TEXT,
ADD COLUMN IF NOT EXISTS "sparklefallColors" TEXT,
ADD COLUMN IF NOT EXISTS "sparklefallEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sparklefallInterval" INTEGER,
ADD COLUMN IF NOT EXISTS "sparklefallMaxSize" INTEGER,
ADD COLUMN IF NOT EXISTS "sparklefallMaxSparkles" INTEGER,
ADD COLUMN IF NOT EXISTS "sparklefallMinSize" INTEGER,
ADD COLUMN IF NOT EXISTS "sparklefallPreset" TEXT,
ADD COLUMN IF NOT EXISTS "sparklefallSparkles" TEXT,
ADD COLUMN IF NOT EXISTS "sparklefallWind" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "usernameFont" TEXT;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "ContentViolation" (
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

CREATE TABLE IF NOT EXISTS "PostAudience" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "ContentViolation_userId_idx" ON "ContentViolation"("userId");
CREATE INDEX IF NOT EXISTS "ContentViolation_postId_idx" ON "ContentViolation"("postId");
CREATE INDEX IF NOT EXISTS "PostAudience_postId_idx" ON "PostAudience"("postId");
CREATE INDEX IF NOT EXISTS "PostAudience_userId_idx" ON "PostAudience"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PostAudience_postId_userId_key" ON "PostAudience"("postId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AddForeignKey (idempotent: use DO block to check)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ContentViolation_userId_fkey') THEN
    ALTER TABLE "ContentViolation" ADD CONSTRAINT "ContentViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ContentViolation_postId_fkey') THEN
    ALTER TABLE "ContentViolation" ADD CONSTRAINT "ContentViolation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostAudience_postId_fkey') THEN
    ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PostAudience_userId_fkey') THEN
    ALTER TABLE "PostAudience" ADD CONSTRAINT "PostAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
