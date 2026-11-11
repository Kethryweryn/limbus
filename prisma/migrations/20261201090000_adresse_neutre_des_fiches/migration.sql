-- Adresse de page neutre pour chaque fiche participant (SPEC-022, US-239, revue de la PR #232) : une fiche suivie par
-- plusieurs équipes ne doit pas montrer dans son adresse le nom qu'une équipe lui a donné. « p- » et dix caractères
-- tirés au hasard, dans l'alphabet de utils/participantSlug.ts (0 et 1 remplacés) ; une collision ferait échouer la
-- migration, sans rien changer.
UPDATE "Participant"
SET "slug" = 'p-' || translate(substr(md5(random()::text || "id"), 1, 10), '01', 'gh');
