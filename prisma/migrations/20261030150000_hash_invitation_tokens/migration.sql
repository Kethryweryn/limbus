-- Le jeton d'une invitation est gardé haché, comme les liens personnels (US-042, ADR-0034)
-- deploiement-incompatible : les jetons en clair sont remplacés par leur empreinte ; pendant les quelques secondes du déploiement, l'ancien build ne retrouve plus une invitation par son lien, le nouveau la retrouve.
ALTER TABLE "GameInvitation" ADD COLUMN "tokenHash" TEXT;

CREATE UNIQUE INDEX "GameInvitation_tokenHash_key" ON "GameInvitation"("tokenHash");

ALTER TABLE "GameInvitation" ALTER COLUMN "token" DROP NOT NULL;

-- Même empreinte que l'application : SHA-256 du jeton, en hexadécimal
UPDATE "GameInvitation" SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex'), "token" = NULL
WHERE "token" IS NOT NULL;
