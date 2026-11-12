-- Recopie champ par champ (US-245, ADR-0089) : chaque compte activé tient son nom, et les champs qu'il a remplis.
-- Le nom et le téléphone de chaque jeu de ses fiches deviennent les siens ; un téléphone vide ne touche à rien.
-- Les inscriptions d'un compte qui a enregistré ses coordonnées les ont déjà reçues (ADR-0042).
UPDATE "ParticipantGame" pg
SET "name" = u."name"
FROM "Participant" p
JOIN "User" u ON u."id" = p."userId"
WHERE pg."participantId" = p."id"
  AND u."emailConfirmedAt" IS NOT NULL
  AND btrim(u."name") <> ''
  AND pg."name" IS DISTINCT FROM u."name";

UPDATE "ParticipantGame" pg
SET "phone" = u."phone"
FROM "Participant" p
JOIN "User" u ON u."id" = p."userId"
WHERE pg."participantId" = p."id"
  AND u."emailConfirmedAt" IS NOT NULL
  AND u."phone" IS NOT NULL
  AND pg."phone" IS DISTINCT FROM u."phone";
