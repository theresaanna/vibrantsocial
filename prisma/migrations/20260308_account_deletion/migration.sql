-- Make Post.authorId nullable and change cascade to SetNull
ALTER TABLE "Post" ALTER COLUMN "authorId" DROP NOT NULL;

-- Add isAuthorDeleted flag to Post
ALTER TABLE "Post" ADD COLUMN "isAuthorDeleted" BOOLEAN NOT NULL DEFAULT false;

-- Drop existing foreign key and recreate with SET NULL
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create DeletedUser table
CREATE TABLE "DeletedUser" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedUser_pkey" PRIMARY KEY ("id")
);

-- Create unique index on originalId
CREATE UNIQUE INDEX "DeletedUser_originalId_key" ON "DeletedUser"("originalId");
