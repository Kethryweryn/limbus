-- Empreinte de la version envoyée, pour renvoyer une version à jour (US-030, ADR-0031)
ALTER TABLE "SessionDocumentDelivery" ADD COLUMN "contentHash" TEXT;
