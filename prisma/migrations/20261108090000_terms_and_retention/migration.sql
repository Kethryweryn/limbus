-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inactivityReportedAt" TIMESTAMP(3),
ADD COLUMN     "inactivityWarnedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedVersion" TEXT;

