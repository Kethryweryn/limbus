-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "photoRetentionMonths" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "photoRefusedAt" TIMESTAMP(3);

