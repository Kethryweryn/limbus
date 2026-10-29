-- Notes propres à chaque jeu (US-069, ADR-0040) : copiées dans chaque lien, puis retirées de la fiche commune.
-- La colonne Participant.notes reste pour le build en service ; elle sera supprimée plus tard
ALTER TABLE "ParticipantGame" ADD COLUMN "notes" TEXT;
UPDATE "ParticipantGame" AS link SET "notes" = participant."notes"
FROM "Participant" AS participant
WHERE participant."id" = link."participantId" AND participant."notes" IS NOT NULL;
UPDATE "Participant" SET "notes" = NULL WHERE "notes" IS NOT NULL;
