ALTER TABLE "Character" ADD COLUMN "excludeFromTrombinoscope" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Character" ADD COLUMN "trombinoscopeFaceHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Character" ADD COLUMN "trombinoscopePhotoUrl" TEXT;
ALTER TABLE "Character" ADD COLUMN "trombinoscopeNote" TEXT;
ALTER TABLE "Character" ADD COLUMN "trombinoscopeDisplayName" TEXT;

CREATE TABLE "CharacterTrombinoscopeEntry" (
    "id" TEXT NOT NULL,
    "viewerCharacterId" TEXT NOT NULL,
    "targetCharacterId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "faceKnown" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterTrombinoscopeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionTrombinoscope" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "viewerCharacterId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "missingPhotos" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTrombinoscope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterTrombinoscopeEntry_viewerCharacterId_targetCharacterId_key" ON "CharacterTrombinoscopeEntry"("viewerCharacterId", "targetCharacterId");
CREATE INDEX "CharacterTrombinoscopeEntry_targetCharacterId_idx" ON "CharacterTrombinoscopeEntry"("targetCharacterId");

CREATE UNIQUE INDEX "SessionTrombinoscope_sessionId_viewerCharacterId_participantId_key" ON "SessionTrombinoscope"("sessionId", "viewerCharacterId", "participantId");
CREATE INDEX "SessionTrombinoscope_participantId_idx" ON "SessionTrombinoscope"("participantId");

ALTER TABLE "CharacterTrombinoscopeEntry" ADD CONSTRAINT "CharacterTrombinoscopeEntry_viewerCharacterId_fkey" FOREIGN KEY ("viewerCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterTrombinoscopeEntry" ADD CONSTRAINT "CharacterTrombinoscopeEntry_targetCharacterId_fkey" FOREIGN KEY ("targetCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionTrombinoscope" ADD CONSTRAINT "SessionTrombinoscope_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionTrombinoscope" ADD CONSTRAINT "SessionTrombinoscope_viewerCharacterId_fkey" FOREIGN KEY ("viewerCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionTrombinoscope" ADD CONSTRAINT "SessionTrombinoscope_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
