-- Paiement d'une personne partie, date limite de désistement, place offerte (US-039 à US-041, ADR-0033)
ALTER TABLE "Session" ADD COLUMN "withdrawalDeadline" TIMESTAMP(3);

ALTER TABLE "SessionPayment" ADD COLUMN "offered" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SessionPayment" ADD COLUMN "transferredToParticipantId" TEXT;

ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_transferredToParticipantId_fkey" FOREIGN KEY ("transferredToParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
