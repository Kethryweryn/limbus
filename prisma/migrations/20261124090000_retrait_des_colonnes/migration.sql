-- US-193, second déploiement : retrait des colonnes que le code n'emploie plus depuis le premier (20261123090000).
--
-- deploiement-incompatible : suppressions. Le build en service ne connaît plus ces colonnes ni ce type : son client
-- Prisma ne les lit ni ne les écrit.
-- Production relevée le 2026-11-09 : colonnes vides ; aucun trombinoscope n'a son PDF dans l'ancienne colonne seule.

-- Un trombinoscope généré par le build d'avant pendant le premier déploiement n'a que son ancienne colonne : recopié
UPDATE "SessionTrombinoscope" SET "contentPdf" = decode("contentPdfBase64", 'base64')
WHERE "contentPdf" IS NULL AND "contentPdfBase64" IS NOT NULL;
ALTER TABLE "SessionTrombinoscope" DROP COLUMN "contentPdfBase64";

-- Ancien personnage d'un document (ADR-0072) et ancien public, avec son type
ALTER TABLE "Document" DROP CONSTRAINT "Document_characterId_gameId_fkey";
DROP INDEX "Document_characterId_gameId_idx";
ALTER TABLE "Document" DROP COLUMN "audience",
DROP COLUMN "characterId";
DROP TYPE "DocumentAudience";

-- Jeton en clair des invitations d'avant ADR-0034, et notes d'une fiche d'avant ADR-0040
DROP INDEX "GameInvitation_token_key";
ALTER TABLE "GameInvitation" DROP COLUMN "token";
ALTER TABLE "Participant" DROP COLUMN "notes";
