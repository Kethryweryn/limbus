-- US-190 (ADR-0073) : règles entre colonnes tenues par la base, écrites à la main car Prisma ne les décrit pas.
-- Production relevée le 2026-11-09 : aucune ligne ne les enfreint. Le code les vérifiait déjà avant d'écrire.

-- Un lien du questionnaire vise exactement un personnage, un groupe ou une intrigue
ALTER TABLE "RegistrationQuestionLink"
  ADD CONSTRAINT "RegistrationQuestionLink_une_cible_check"
  CHECK (num_nonnulls("characterId", "factionId", "intrigueId") = 1);

-- Deux liens identiques (même question, même option, même cible) sont refusés : un index unique par sorte de cible.
-- Partiels, ils échappent à la comparaison de Prisma (un index NULLS NOT DISTINCT serait retiré par la migration suivante).
CREATE UNIQUE INDEX "RegistrationQuestionLink_personnage_unique_key"
  ON "RegistrationQuestionLink" ("gameId", "questionId", "option", "characterId") WHERE "characterId" IS NOT NULL;
CREATE UNIQUE INDEX "RegistrationQuestionLink_groupe_unique_key"
  ON "RegistrationQuestionLink" ("gameId", "questionId", "option", "factionId") WHERE "factionId" IS NOT NULL;
CREATE UNIQUE INDEX "RegistrationQuestionLink_intrigue_unique_key"
  ON "RegistrationQuestionLink" ("gameId", "questionId", "option", "intrigueId") WHERE "intrigueId" IS NOT NULL;

-- Une relation ne relie pas un personnage à lui-même ; deux personnages peuvent en avoir plusieurs, dans les deux sens
ALTER TABLE "CharacterRelation"
  ADD CONSTRAINT "CharacterRelation_deux_personnages_check"
  CHECK ("fromCharacterId" <> "toCharacterId");
