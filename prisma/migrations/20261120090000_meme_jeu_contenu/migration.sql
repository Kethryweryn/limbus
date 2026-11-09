-- US-191 (ADR-0074) : la base refuse un lien entre éléments de deux jeux. Chaque élément du contenu reçoit une unicité
-- (id, gameId), et chaque lien entre deux éléments une clé étrangère composée avec le jeu.
--
-- deploiement-incompatible : les tables de liaison implicites (_CharacterFactions…) sont recopiées dans des tables qui
-- portent le jeu. Le build encore en service lit et écrit les anciennes, gardées telles quelles jusqu'à l'US-193 : un lien
-- qu'il ajoute ou retire pendant les secondes du déploiement n'est pas recopié (accepté, comme pour US-189). Les cases du
-- trombinoscope reçoivent le jeu : une case qu'il crée à ce moment est refusée, comme la suppression d'un personnage
-- qui porte un objet (la référence n'est plus vidée par la base, ADR-0074).
-- Production relevée le 2026-11-09 : aucun lien ne relie deux jeux.

-- Unicité (id, gameId) : cible des clés composées
CREATE UNIQUE INDEX "Character_id_gameId_key" ON "Character"("id", "gameId");
CREATE UNIQUE INDEX "Document_id_gameId_key" ON "Document"("id", "gameId");
CREATE UNIQUE INDEX "Faction_id_gameId_key" ON "Faction"("id", "gameId");
CREATE UNIQUE INDEX "Intrigue_id_gameId_key" ON "Intrigue"("id", "gameId");
CREATE UNIQUE INDEX "Item_id_gameId_key" ON "Item"("id", "gameId");
CREATE UNIQUE INDEX "TimelineEvent_id_gameId_key" ON "TimelineEvent"("id", "gameId");

-- Tables de liaison qui portent le jeu, remplies depuis les anciennes (le jeu est celui de l'élément A)
CREATE TABLE "CharacterFaction" (
    "gameId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,

    CONSTRAINT "CharacterFaction_pkey" PRIMARY KEY ("characterId","gameId","factionId")
);
INSERT INTO "CharacterFaction" ("gameId", "characterId", "factionId")
  SELECT a."gameId", l."A", l."B" FROM "_CharacterFactions" l JOIN "Character" a ON a."id" = l."A";
CREATE INDEX "CharacterFaction_factionId_gameId_idx" ON "CharacterFaction"("factionId", "gameId");
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_factionId_gameId_fkey" FOREIGN KEY ("factionId", "gameId") REFERENCES "Faction"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "CharacterIntrigue" (
    "gameId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "intrigueId" TEXT NOT NULL,

    CONSTRAINT "CharacterIntrigue_pkey" PRIMARY KEY ("characterId","gameId","intrigueId")
);
INSERT INTO "CharacterIntrigue" ("gameId", "characterId", "intrigueId")
  SELECT a."gameId", l."A", l."B" FROM "_CharacterIntrigues" l JOIN "Character" a ON a."id" = l."A";
CREATE INDEX "CharacterIntrigue_intrigueId_gameId_idx" ON "CharacterIntrigue"("intrigueId", "gameId");
ALTER TABLE "CharacterIntrigue" ADD CONSTRAINT "CharacterIntrigue_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterIntrigue" ADD CONSTRAINT "CharacterIntrigue_intrigueId_gameId_fkey" FOREIGN KEY ("intrigueId", "gameId") REFERENCES "Intrigue"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "CharacterItem" (
    "gameId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "CharacterItem_pkey" PRIMARY KEY ("characterId","gameId","itemId")
);
INSERT INTO "CharacterItem" ("gameId", "characterId", "itemId")
  SELECT a."gameId", l."A", l."B" FROM "_CharacterItems" l JOIN "Character" a ON a."id" = l."A";
CREATE INDEX "CharacterItem_itemId_gameId_idx" ON "CharacterItem"("itemId", "gameId");
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_itemId_gameId_fkey" FOREIGN KEY ("itemId", "gameId") REFERENCES "Item"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "DocumentCharacter" (
    "gameId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "DocumentCharacter_pkey" PRIMARY KEY ("documentId","gameId","characterId")
);
INSERT INTO "DocumentCharacter" ("gameId", "documentId", "characterId")
  SELECT a."gameId", l."B", l."A" FROM "_DocumentCharacters" l JOIN "Document" a ON a."id" = l."B";
CREATE INDEX "DocumentCharacter_characterId_gameId_idx" ON "DocumentCharacter"("characterId", "gameId");
ALTER TABLE "DocumentCharacter" ADD CONSTRAINT "DocumentCharacter_documentId_gameId_fkey" FOREIGN KEY ("documentId", "gameId") REFERENCES "Document"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "DocumentCharacter" ADD CONSTRAINT "DocumentCharacter_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "DocumentFaction" (
    "gameId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,

    CONSTRAINT "DocumentFaction_pkey" PRIMARY KEY ("documentId","gameId","factionId")
);
INSERT INTO "DocumentFaction" ("gameId", "documentId", "factionId")
  SELECT a."gameId", l."A", l."B" FROM "_DocumentFactions" l JOIN "Document" a ON a."id" = l."A";
CREATE INDEX "DocumentFaction_factionId_gameId_idx" ON "DocumentFaction"("factionId", "gameId");
ALTER TABLE "DocumentFaction" ADD CONSTRAINT "DocumentFaction_documentId_gameId_fkey" FOREIGN KEY ("documentId", "gameId") REFERENCES "Document"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "DocumentFaction" ADD CONSTRAINT "DocumentFaction_factionId_gameId_fkey" FOREIGN KEY ("factionId", "gameId") REFERENCES "Faction"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "FactionIntrigue" (
    "gameId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "intrigueId" TEXT NOT NULL,

    CONSTRAINT "FactionIntrigue_pkey" PRIMARY KEY ("factionId","gameId","intrigueId")
);
INSERT INTO "FactionIntrigue" ("gameId", "factionId", "intrigueId")
  SELECT a."gameId", l."A", l."B" FROM "_FactionIntrigues" l JOIN "Faction" a ON a."id" = l."A";
CREATE INDEX "FactionIntrigue_intrigueId_gameId_idx" ON "FactionIntrigue"("intrigueId", "gameId");
ALTER TABLE "FactionIntrigue" ADD CONSTRAINT "FactionIntrigue_factionId_gameId_fkey" FOREIGN KEY ("factionId", "gameId") REFERENCES "Faction"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "FactionIntrigue" ADD CONSTRAINT "FactionIntrigue_intrigueId_gameId_fkey" FOREIGN KEY ("intrigueId", "gameId") REFERENCES "Intrigue"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "IntrigueItem" (
    "gameId" TEXT NOT NULL,
    "intrigueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "IntrigueItem_pkey" PRIMARY KEY ("intrigueId","gameId","itemId")
);
INSERT INTO "IntrigueItem" ("gameId", "intrigueId", "itemId")
  SELECT a."gameId", l."A", l."B" FROM "_IntrigueItems" l JOIN "Intrigue" a ON a."id" = l."A";
CREATE INDEX "IntrigueItem_itemId_gameId_idx" ON "IntrigueItem"("itemId", "gameId");
ALTER TABLE "IntrigueItem" ADD CONSTRAINT "IntrigueItem_intrigueId_gameId_fkey" FOREIGN KEY ("intrigueId", "gameId") REFERENCES "Intrigue"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "IntrigueItem" ADD CONSTRAINT "IntrigueItem_itemId_gameId_fkey" FOREIGN KEY ("itemId", "gameId") REFERENCES "Item"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "TimelineEventCharacter" (
    "gameId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "TimelineEventCharacter_pkey" PRIMARY KEY ("timelineEventId","gameId","characterId")
);
INSERT INTO "TimelineEventCharacter" ("gameId", "timelineEventId", "characterId")
  SELECT a."gameId", l."B", l."A" FROM "_TimelineEventCharacters" l JOIN "TimelineEvent" a ON a."id" = l."B";
CREATE INDEX "TimelineEventCharacter_characterId_gameId_idx" ON "TimelineEventCharacter"("characterId", "gameId");
ALTER TABLE "TimelineEventCharacter" ADD CONSTRAINT "TimelineEventCharacter_timelineEventId_gameId_fkey" FOREIGN KEY ("timelineEventId", "gameId") REFERENCES "TimelineEvent"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventCharacter" ADD CONSTRAINT "TimelineEventCharacter_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "TimelineEventFaction" (
    "gameId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,

    CONSTRAINT "TimelineEventFaction_pkey" PRIMARY KEY ("timelineEventId","gameId","factionId")
);
INSERT INTO "TimelineEventFaction" ("gameId", "timelineEventId", "factionId")
  SELECT a."gameId", l."B", l."A" FROM "_TimelineEventFactions" l JOIN "TimelineEvent" a ON a."id" = l."B";
CREATE INDEX "TimelineEventFaction_factionId_gameId_idx" ON "TimelineEventFaction"("factionId", "gameId");
ALTER TABLE "TimelineEventFaction" ADD CONSTRAINT "TimelineEventFaction_timelineEventId_gameId_fkey" FOREIGN KEY ("timelineEventId", "gameId") REFERENCES "TimelineEvent"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventFaction" ADD CONSTRAINT "TimelineEventFaction_factionId_gameId_fkey" FOREIGN KEY ("factionId", "gameId") REFERENCES "Faction"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "TimelineEventIntrigue" (
    "gameId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "intrigueId" TEXT NOT NULL,

    CONSTRAINT "TimelineEventIntrigue_pkey" PRIMARY KEY ("timelineEventId","gameId","intrigueId")
);
INSERT INTO "TimelineEventIntrigue" ("gameId", "timelineEventId", "intrigueId")
  SELECT a."gameId", l."B", l."A" FROM "_TimelineEventIntrigues" l JOIN "TimelineEvent" a ON a."id" = l."B";
CREATE INDEX "TimelineEventIntrigue_intrigueId_gameId_idx" ON "TimelineEventIntrigue"("intrigueId", "gameId");
ALTER TABLE "TimelineEventIntrigue" ADD CONSTRAINT "TimelineEventIntrigue_timelineEventId_gameId_fkey" FOREIGN KEY ("timelineEventId", "gameId") REFERENCES "TimelineEvent"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventIntrigue" ADD CONSTRAINT "TimelineEventIntrigue_intrigueId_gameId_fkey" FOREIGN KEY ("intrigueId", "gameId") REFERENCES "Intrigue"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE TABLE "TimelineEventItem" (
    "gameId" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "TimelineEventItem_pkey" PRIMARY KEY ("timelineEventId","gameId","itemId")
);
INSERT INTO "TimelineEventItem" ("gameId", "timelineEventId", "itemId")
  SELECT a."gameId", l."B", l."A" FROM "_TimelineEventItems" l JOIN "TimelineEvent" a ON a."id" = l."B";
CREATE INDEX "TimelineEventItem_itemId_gameId_idx" ON "TimelineEventItem"("itemId", "gameId");
ALTER TABLE "TimelineEventItem" ADD CONSTRAINT "TimelineEventItem_timelineEventId_gameId_fkey" FOREIGN KEY ("timelineEventId", "gameId") REFERENCES "TimelineEvent"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "TimelineEventItem" ADD CONSTRAINT "TimelineEventItem_itemId_gameId_fkey" FOREIGN KEY ("itemId", "gameId") REFERENCES "Item"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Cases du trombinoscope : le jeu des deux personnages
ALTER TABLE "CharacterTrombinoscopeEntry" ADD COLUMN "gameId" TEXT;
UPDATE "CharacterTrombinoscopeEntry" e SET "gameId" = c."gameId" FROM "Character" c WHERE c."id" = e."viewerCharacterId";
ALTER TABLE "CharacterTrombinoscopeEntry" ALTER COLUMN "gameId" SET NOT NULL;

-- Références existantes passées aux clés composées
ALTER TABLE "CharacterRelation" DROP CONSTRAINT "CharacterRelation_fromCharacterId_fkey";
ALTER TABLE "CharacterRelation" DROP CONSTRAINT "CharacterRelation_toCharacterId_fkey";
DROP INDEX "CharacterRelation_fromCharacterId_idx";
DROP INDEX "CharacterRelation_toCharacterId_idx";
CREATE INDEX "CharacterRelation_fromCharacterId_gameId_idx" ON "CharacterRelation"("fromCharacterId", "gameId");
CREATE INDEX "CharacterRelation_toCharacterId_gameId_idx" ON "CharacterRelation"("toCharacterId", "gameId");
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_fromCharacterId_gameId_fkey" FOREIGN KEY ("fromCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_toCharacterId_gameId_fkey" FOREIGN KEY ("toCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterTrombinoscopeEntry" DROP CONSTRAINT "CharacterTrombinoscopeEntry_targetCharacterId_fkey";
ALTER TABLE "CharacterTrombinoscopeEntry" DROP CONSTRAINT "CharacterTrombinoscopeEntry_viewerCharacterId_fkey";
DROP INDEX "CharacterTrombinoscopeEntry_targetCharacterId_idx";
CREATE INDEX "CharacterTrombinoscopeEntry_viewerCharacterId_gameId_idx" ON "CharacterTrombinoscopeEntry"("viewerCharacterId", "gameId");
CREATE INDEX "CharacterTrombinoscopeEntry_targetCharacterId_gameId_idx" ON "CharacterTrombinoscopeEntry"("targetCharacterId", "gameId");
ALTER TABLE "CharacterTrombinoscopeEntry" ADD CONSTRAINT "CharacterTrombinoscopeEntry_viewerCharacterId_gameId_fkey" FOREIGN KEY ("viewerCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "CharacterTrombinoscopeEntry" ADD CONSTRAINT "CharacterTrombinoscopeEntry_targetCharacterId_gameId_fkey" FOREIGN KEY ("targetCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "Document" DROP CONSTRAINT "Document_characterId_fkey";
DROP INDEX "Document_characterId_idx";
CREATE INDEX "Document_characterId_gameId_idx" ON "Document"("characterId", "gameId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Item" DROP CONSTRAINT "Item_locationCharacterId_fkey";
DROP INDEX "Item_locationCharacterId_idx";
CREATE INDEX "Item_locationCharacterId_gameId_idx" ON "Item"("locationCharacterId", "gameId");
ALTER TABLE "Item" ADD CONSTRAINT "Item_locationCharacterId_gameId_fkey" FOREIGN KEY ("locationCharacterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "RegistrationQuestionLink" DROP CONSTRAINT "RegistrationQuestionLink_characterId_fkey";
ALTER TABLE "RegistrationQuestionLink" DROP CONSTRAINT "RegistrationQuestionLink_factionId_fkey";
ALTER TABLE "RegistrationQuestionLink" DROP CONSTRAINT "RegistrationQuestionLink_intrigueId_fkey";
DROP INDEX "RegistrationQuestionLink_characterId_idx";
DROP INDEX "RegistrationQuestionLink_factionId_idx";
DROP INDEX "RegistrationQuestionLink_intrigueId_idx";
CREATE INDEX "RegistrationQuestionLink_characterId_gameId_idx" ON "RegistrationQuestionLink"("characterId", "gameId");
CREATE INDEX "RegistrationQuestionLink_factionId_gameId_idx" ON "RegistrationQuestionLink"("factionId", "gameId");
CREATE INDEX "RegistrationQuestionLink_intrigueId_gameId_idx" ON "RegistrationQuestionLink"("intrigueId", "gameId");
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_characterId_gameId_fkey" FOREIGN KEY ("characterId", "gameId") REFERENCES "Character"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_factionId_gameId_fkey" FOREIGN KEY ("factionId", "gameId") REFERENCES "Faction"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_intrigueId_gameId_fkey" FOREIGN KEY ("intrigueId", "gameId") REFERENCES "Intrigue"("id", "gameId") ON DELETE CASCADE ON UPDATE NO ACTION;
