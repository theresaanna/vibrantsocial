-- AlterTable
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Post_authorId_slug_key" ON "Post"("authorId", "slug");
