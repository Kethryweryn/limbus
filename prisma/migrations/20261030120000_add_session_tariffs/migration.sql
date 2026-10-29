-- Tarifs d'une session et versements reçus (US-031, US-032, ADR-0032)
CREATE TABLE "SessionTariff" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "defaultRole" TEXT,
    "baseTariffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTariff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionTariff_sessionId_defaultRole_key" ON "SessionTariff"("sessionId", "defaultRole");

ALTER TABLE "SessionTariff" ADD CONSTRAINT "SessionTariff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionTariff" ADD CONSTRAINT "SessionTariff_baseTariffId_fkey" FOREIGN KEY ("baseTariffId") REFERENCES "SessionTariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionPayment" ADD COLUMN "tariffId" TEXT;

ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "SessionTariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SessionPaymentInstalment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPaymentInstalment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionPaymentInstalment_paymentId_idx" ON "SessionPaymentInstalment"("paymentId");

ALTER TABLE "SessionPaymentInstalment" ADD CONSTRAINT "SessionPaymentInstalment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SessionPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
