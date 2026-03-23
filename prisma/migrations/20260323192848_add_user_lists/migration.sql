-- CreateTable
CREATE TABLE "UserList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserList_ownerId_idx" ON "UserList"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserList_ownerId_name_key" ON "UserList"("ownerId", "name");

-- CreateIndex
CREATE INDEX "UserListMember_listId_idx" ON "UserListMember"("listId");

-- CreateIndex
CREATE INDEX "UserListMember_userId_idx" ON "UserListMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserListMember_listId_userId_key" ON "UserListMember"("listId", "userId");

-- AddForeignKey
ALTER TABLE "UserList" ADD CONSTRAINT "UserList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListMember" ADD CONSTRAINT "UserListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListMember" ADD CONSTRAINT "UserListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
