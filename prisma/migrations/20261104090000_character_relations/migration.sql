-- Relations entre personnages et questionnaire relié aux rôles (EPIC-024, ADR-0050)
-- CreateTable
CREATE TABLE "CharacterRelation" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "fromCharacterId" TEXT NOT NULL,
    "fromLabel" TEXT,
    "fromVisible" BOOLEAN NOT NULL DEFAULT false,
    "toCharacterId" TEXT NOT NULL,
    "toLabel" TEXT,
    "toVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationQuestionLink" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "option" TEXT NOT NULL DEFAULT '',
    "characterId" TEXT,
    "factionId" TEXT,
    "intrigueId" TEXT,

    CONSTRAINT "RegistrationQuestionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterRelation_gameId_idx" ON "CharacterRelation"("gameId");

-- CreateIndex
CREATE INDEX "CharacterRelation_fromCharacterId_idx" ON "CharacterRelation"("fromCharacterId");

-- CreateIndex
CREATE INDEX "CharacterRelation_toCharacterId_idx" ON "CharacterRelation"("toCharacterId");

-- CreateIndex
CREATE INDEX "RegistrationQuestionLink_gameId_idx" ON "RegistrationQuestionLink"("gameId");

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_fromCharacterId_fkey" FOREIGN KEY ("fromCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_toCharacterId_fkey" FOREIGN KEY ("toCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationQuestionLink" ADD CONSTRAINT "RegistrationQuestionLink_intrigueId_fkey" FOREIGN KEY ("intrigueId") REFERENCES "Intrigue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

