-- AlterTable: Add links page columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linksPageEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linksPageBio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linksPageSensitiveLinks" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LinksPageLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinksPageLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinksPageLink_userId_idx" ON "LinksPageLink"("userId");

-- AddForeignKey
ALTER TABLE "LinksPageLink" DROP CONSTRAINT IF EXISTS "LinksPageLink_userId_fkey";
ALTER TABLE "LinksPageLink" ADD CONSTRAINT "LinksPageLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
