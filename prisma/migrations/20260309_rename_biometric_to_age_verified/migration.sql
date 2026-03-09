-- Rename biometricVerified to ageVerified
ALTER TABLE "User" RENAME COLUMN "biometricVerified" TO "ageVerified";

-- Add ageVerificationUuid column for tracking AgeChecker.net verification requests
ALTER TABLE "User" ADD COLUMN "ageVerificationUuid" TEXT;
