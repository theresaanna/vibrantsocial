-- Add content moderation fields to Message
ALTER TABLE "Message" ADD COLUMN "isNsfw" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "nsfwScore" DOUBLE PRECISION;

-- Add CHAT_ABUSE to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'CHAT_ABUSE';

-- Chat abuse flags (tracks high-confidence abuse per sender→recipient pair)
CREATE TABLE "ChatAbuseFlag" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "violationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAbuseFlag_pkey" PRIMARY KEY ("id")
);

-- Chat abuse dismissals (user opts out of alerts from a specific sender)
CREATE TABLE "ChatAbuseDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedSenderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAbuseDismissal_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ChatAbuseFlag_senderId_recipientId_idx" ON "ChatAbuseFlag"("senderId", "recipientId");
CREATE INDEX "ChatAbuseFlag_recipientId_idx" ON "ChatAbuseFlag"("recipientId");

CREATE UNIQUE INDEX "ChatAbuseDismissal_userId_dismissedSenderId_key" ON "ChatAbuseDismissal"("userId", "dismissedSenderId");
CREATE INDEX "ChatAbuseDismissal_userId_idx" ON "ChatAbuseDismissal"("userId");

-- Foreign keys
ALTER TABLE "ChatAbuseFlag" ADD CONSTRAINT "ChatAbuseFlag_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAbuseFlag" ADD CONSTRAINT "ChatAbuseFlag_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAbuseFlag" ADD CONSTRAINT "ChatAbuseFlag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatAbuseDismissal" ADD CONSTRAINT "ChatAbuseDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAbuseDismissal" ADD CONSTRAINT "ChatAbuseDismissal_dismissedSenderId_fkey" FOREIGN KEY ("dismissedSenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
