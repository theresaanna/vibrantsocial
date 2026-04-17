-- DropForeignKey
ALTER TABLE "ExpoPushToken" DROP CONSTRAINT IF EXISTS "ExpoPushToken_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ExpoPushToken";
