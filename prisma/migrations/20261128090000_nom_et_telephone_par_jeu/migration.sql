-- Nom et téléphone par jeu (SPEC-022 R6, ADR-0086, US-237) : chaque lien reçoit les valeurs actuelles de sa fiche.
-- Colonnes facultatives : le build en service, qui ne les connaît pas, continue de créer des liens (ADR-0024).
ALTER TABLE "ParticipantGame" ADD COLUMN "name" TEXT;
ALTER TABLE "ParticipantGame" ADD COLUMN "phone" TEXT;
ALTER TABLE "ParticipantGame" ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ParticipantGame" AS link
SET "name" = participant."name", "phone" = participant."phone"
FROM "Participant" AS participant
WHERE participant."id" = link."participantId";
