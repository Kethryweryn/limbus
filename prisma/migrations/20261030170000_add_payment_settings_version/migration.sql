-- Version des réglages de paiement d'une session (US-050, ADR-0036)
ALTER TABLE "Session" ADD COLUMN "paymentSettingsUpdatedAt" TIMESTAMP(3);
