-- deploiement-incompatible : l'ancien modèle des inscriptions disparaît (ADR-0069). Le build en service ne le lit plus, mais son client Prisma nomme encore ces colonnes : ses lectures échouent jusqu'à la bascule, très courte. Accepté tant que la production n'a que des données de test.
-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_retainedById_fkey";

-- DropForeignKey
ALTER TABLE "RegistrationAvailability" DROP CONSTRAINT "RegistrationAvailability_registrationId_fkey";

-- DropForeignKey
ALTER TABLE "RegistrationAvailability" DROP CONSTRAINT "RegistrationAvailability_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "RegistrationWaitlistEntry" DROP CONSTRAINT "RegistrationWaitlistEntry_registrationId_fkey";

-- DropForeignKey
ALTER TABLE "RegistrationWaitlistEntry" DROP CONSTRAINT "RegistrationWaitlistEntry_sessionId_fkey";

-- DropIndex
DROP INDEX "RegistrationPeriod_gameId_idx";

-- DropIndex
DROP INDEX "Registration_sessionId_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "poolSeats";

-- AlterTable
ALTER TABLE "RegistrationPeriod" DROP COLUMN "closesAt",
DROP COLUMN "entryMode",
DROP COLUMN "name",
DROP COLUMN "organizerPicks",
DROP COLUMN "scope",
DROP COLUMN "selectionMode",
DROP COLUMN "waitlistSize",
DROP COLUMN "weightBalance",
DROP COLUMN "weightNotDrawnBefore";

-- AlterTable
ALTER TABLE "RegistrationPeriodSession" DROP COLUMN "seats";

-- AlterTable
ALTER TABLE "Registration" DROP COLUMN "announcedAt",
DROP COLUMN "announcedSessionId",
DROP COLUMN "announcedStatus",
DROP COLUMN "confirmedAt",
DROP COLUMN "retainedById",
DROP COLUMN "sessionId";

-- DropTable
DROP TABLE "RegistrationAvailability";

-- DropTable
DROP TABLE "RegistrationWaitlistEntry";

