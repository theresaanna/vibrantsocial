-- Remove the content strikes column (strike system removed in favor of warnings-only)
ALTER TABLE "User" DROP COLUMN IF EXISTS "contentStrikes";
