-- Une fiche a toujours au moins un jeu (US-036) : les fiches sans jeu, invisibles de toutes les
-- organisatrices, sont supprimées. Leurs personnages restent au casting, sans joueur ni photo.
UPDATE "SessionAssignment" SET "participantId" = NULL, "photoUrl" = NULL
WHERE "participantId" IN (
  SELECT p."id" FROM "Participant" p
  WHERE NOT EXISTS (SELECT 1 FROM "ParticipantGame" g WHERE g."participantId" = p."id")
);

DELETE FROM "Participant" p
WHERE NOT EXISTS (SELECT 1 FROM "ParticipantGame" g WHERE g."participantId" = p."id");
