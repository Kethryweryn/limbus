-- Le nom et le téléphone d'une fiche vivent sur ses liens aux jeux (SPEC-022, ADR-0086) : le code ne lit ni n'écrit plus
-- ces colonnes, qui deviennent facultatives avant leur retrait (étape 2 de US-242). Le build en service écrit encore un
-- nom : il reste accepté
ALTER TABLE "Participant" ALTER COLUMN "name" DROP NOT NULL;
