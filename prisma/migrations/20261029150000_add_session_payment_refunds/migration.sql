-- Remboursements d'une session annulée ou reportée (US-023, ADR-0029)
ALTER TABLE "SessionPayment" ADD COLUMN     "carriedOverToSessionId" TEXT,
ADD COLUMN     "refundStatus" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_carriedOverToSessionId_fkey" FOREIGN KEY ("carriedOverToSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
