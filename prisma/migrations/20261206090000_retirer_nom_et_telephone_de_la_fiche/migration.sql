-- deploiement-incompatible : le nom et le téléphone de la fiche disparaissent (SPEC-022, ADR-0086, US-242 étape 2). Le build en service ne les lit ni ne les écrit plus, mais son client Prisma nomme encore ces colonnes dans les lectures de fiche entière : elles échouent jusqu'à la bascule, très courte. Accepté tant que la production n'a que des données de test.

-- Le nom par jeu devient obligatoire : un lien sans nom reprend celui de la fiche, à défaut une chaîne vide
UPDATE "ParticipantGame" AS link
SET "name" = COALESCE(fiche."name", '')
FROM "Participant" AS fiche
WHERE link."participantId" = fiche."id" AND link."name" IS NULL;
ALTER TABLE "ParticipantGame" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "Participant" DROP COLUMN "name";
ALTER TABLE "Participant" DROP COLUMN "phone";
