-- Une session n'est visible sur la page publique que si on le choisit (US-019) :
-- non visible par défaut, et les sessions existantes ne deviennent pas publiques
ALTER TABLE "Session" ALTER COLUMN "published" SET DEFAULT false;
UPDATE "Session" SET "published" = false;
