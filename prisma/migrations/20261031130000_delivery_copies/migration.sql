-- Copies des envois dans « Je participe » (EPIC-018, ADR-0044)
ALTER TABLE "Session" ADD COLUMN "cancelledAt" TIMESTAMP(3);
UPDATE "Session" SET "cancelledAt" = "updatedAt" WHERE "status" = 'cancelled';

ALTER TABLE "SessionTrombinoscope" ADD COLUMN "contentJson" JSONB;

ALTER TABLE "SessionDocumentDelivery" ADD COLUMN "copyPdf" BYTEA,
ADD COLUMN "copyContent" JSONB,
ADD COLUMN "copySize" INTEGER;
