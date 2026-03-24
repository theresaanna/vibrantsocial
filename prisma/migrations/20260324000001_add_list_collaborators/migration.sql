-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LIST_COLLABORATOR_ADD';

-- CreateTable
CREATE TABLE "UserListCollaborator" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserListCollaborator_listId_idx" ON "UserListCollaborator"("listId");

-- CreateIndex
CREATE INDEX "UserListCollaborator_userId_idx" ON "UserListCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserListCollaborator_listId_userId_key" ON "UserListCollaborator"("listId", "userId");

-- AddForeignKey
ALTER TABLE "UserListCollaborator" ADD CONSTRAINT "UserListCollaborator_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListCollaborator" ADD CONSTRAINT "UserListCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
