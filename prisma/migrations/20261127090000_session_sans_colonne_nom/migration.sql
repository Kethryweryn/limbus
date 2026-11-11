-- deploiement-incompatible : la colonne n'est plus lue ni écrite depuis US-234 (ADR-0084), déjà en service ; l'ancien
-- build qui la lisait n'est plus déployé
-- Une session n'a pas de nom (SPEC-021) : la colonne disparaît (US-236)
ALTER TABLE "Session" DROP COLUMN "name";
