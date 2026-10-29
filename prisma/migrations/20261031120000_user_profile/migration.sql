-- Coordonnées tenues par la personne (US-074, ADR-0042)
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "User" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "dietary" TEXT;
ALTER TABLE "User" ADD COLUMN "healthConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "profileUpdatedAt" TIMESTAMP(3);
