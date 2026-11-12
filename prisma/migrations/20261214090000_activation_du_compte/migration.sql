-- Activation d'un compte pré-créé (US-246, ADR-0088) : un lien d'activation, et le nom d'une inscription porté par
-- son lien de confirmation, appliqué seulement à la confirmation
ALTER TYPE "AccountTokenKind" ADD VALUE 'activate';
ALTER TABLE "AccountToken" ADD COLUMN "name" TEXT;
