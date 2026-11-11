-- Version d'une fiche par équipe (ADR-0086, US-237, étape 3) : le plus récent `updatedAt` de ses liens visibles. Les
-- liens existants avaient reçu l'heure de la migration de l'étape 1, plus récente que leur fiche ; ils reprennent la
-- version de la fiche, pour qu'une modification lue avant ce déploiement (formulaire ouvert, file hors ligne) ne soit
-- pas refusée à tort (revue de la PR #230). Depuis, chaque écriture d'un lien écrit aussi sa fiche.
UPDATE "ParticipantGame" AS link
SET "updatedAt" = participant."updatedAt"
FROM "Participant" AS participant
WHERE participant."id" = link."participantId"
  AND link."updatedAt" > participant."updatedAt";
