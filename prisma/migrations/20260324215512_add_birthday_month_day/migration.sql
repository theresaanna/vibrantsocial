-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "hideLinkPreview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthdayDay" INTEGER,
ADD COLUMN     "birthdayMonth" INTEGER;
