-- Public d'un document : une liste de rôles, plus des personnages et des groupes (US-187, ADR-0072).
-- "audience" et "characterId" restent, pour le build encore en service pendant le déploiement (ADR-0024).
ALTER TABLE "Document" ADD COLUMN "audiences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Document" SET "audiences" = CASE "audience"
  WHEN 'everyone' THEN ARRAY['organizers', 'npcs', 'kitchen', 'pjs']
  WHEN 'organizers' THEN ARRAY['organizers']
  WHEN 'npcs' THEN ARRAY['npcs']
  WHEN 'kitchen' THEN ARRAY['kitchen']
  ELSE ARRAY[]::TEXT[]
END;

-- Le champ « Personnage » rejoint la liste des personnages ("A" : personnage, "B" : document)
INSERT INTO "_DocumentCharacters" ("A", "B")
SELECT "characterId", "id" FROM "Document" WHERE "characterId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "Document" SET "characterId" = NULL WHERE "characterId" IS NOT NULL;
