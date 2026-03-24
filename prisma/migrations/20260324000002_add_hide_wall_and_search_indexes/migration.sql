-- AlterTable
ALTER TABLE "User" ADD COLUMN "hideWallFromFeed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");
