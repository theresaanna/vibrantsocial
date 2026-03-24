-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomThemePreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "lightBgColor" TEXT NOT NULL,
    "lightTextColor" TEXT NOT NULL,
    "lightLinkColor" TEXT NOT NULL,
    "lightSecondaryColor" TEXT NOT NULL,
    "lightContainerColor" TEXT NOT NULL,
    "darkBgColor" TEXT NOT NULL,
    "darkTextColor" TEXT NOT NULL,
    "darkLinkColor" TEXT NOT NULL,
    "darkSecondaryColor" TEXT NOT NULL,
    "darkContainerColor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomThemePreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomThemePreset_userId_idx" ON "CustomThemePreset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomThemePreset_userId_name_key" ON "CustomThemePreset"("userId", "name");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomThemePreset_userId_fkey') THEN
        ALTER TABLE "CustomThemePreset" ADD CONSTRAINT "CustomThemePreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
