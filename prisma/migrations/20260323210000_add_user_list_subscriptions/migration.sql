-- CreateTable
CREATE TABLE "UserListSubscription" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserListSubscription_listId_userId_key" ON "UserListSubscription"("listId", "userId");

-- CreateIndex
CREATE INDEX "UserListSubscription_listId_idx" ON "UserListSubscription"("listId");

-- CreateIndex
CREATE INDEX "UserListSubscription_userId_idx" ON "UserListSubscription"("userId");

-- AddForeignKey
ALTER TABLE "UserListSubscription" ADD CONSTRAINT "UserListSubscription_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListSubscription" ADD CONSTRAINT "UserListSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
