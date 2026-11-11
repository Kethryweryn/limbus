-- Nom et téléphone par jeu (ADR-0086, US-237, étape 2) : les lectures passent aux liens. Chaque lien reprend la valeur
-- de sa fiche, celle que tout le monde voyait jusqu'ici : un lien créé ou laissé en retard par l'ancien build pendant le
-- déploiement de l'étape 1 (revue de la PR #228) se remet à jour.
UPDATE "ParticipantGame" AS link
SET "name" = participant."name", "phone" = participant."phone"
FROM "Participant" AS participant
WHERE participant."id" = link."participantId"
  AND (link."name" IS DISTINCT FROM participant."name" OR link."phone" IS DISTINCT FROM participant."phone");
