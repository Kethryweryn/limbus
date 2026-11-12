-- deploiement-incompatible : le nom et le téléphone de la fiche disparaissent (SPEC-022, ADR-0086, US-242 étape 2). Le build en service ne les lit ni ne les écrit plus, mais son client Prisma nomme encore ces colonnes dans les lectures de fiche entière : elles échouent jusqu'à la bascule, très courte. Accepté tant que la production n'a que des données de test.

-- Le nom par jeu devient obligatoire. Un lien sans nom (aucun depuis US-237) garde le nom vide qu'il montre depuis
-- l'étape 1 : celui de la fiche a pu être saisi par une autre équipe (SPEC-022 R6, revue de la PR #238)
UPDATE "ParticipantGame" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "ParticipantGame" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "Participant" DROP COLUMN "name";
ALTER TABLE "Participant" DROP COLUMN "phone";
