ALTER TABLE "Document" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_characterId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SessionDocumentDelivery" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "documentId" TEXT,
    "characterId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'document',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionDocumentDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionDocumentDelivery_sessionId_kind_idx" ON "SessionDocumentDelivery"("sessionId", "kind");
CREATE INDEX "SessionDocumentDelivery_participantId_idx" ON "SessionDocumentDelivery"("participantId");
CREATE INDEX "SessionDocumentDelivery_documentId_idx" ON "SessionDocumentDelivery"("documentId");
CREATE INDEX "SessionDocumentDelivery_characterId_idx" ON "SessionDocumentDelivery"("characterId");
CREATE UNIQUE INDEX "SessionDocumentDelivery_document_once_key" ON "SessionDocumentDelivery"("sessionId", "documentId", "participantId", "kind") WHERE "documentId" IS NOT NULL AND "kind" = 'document';
CREATE UNIQUE INDEX "SessionDocumentDelivery_character_sheet_once_key" ON "SessionDocumentDelivery"("sessionId", "characterId", "participantId", "kind") WHERE "characterId" IS NOT NULL AND "kind" = 'character_sheet';

ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionDocumentDelivery" ADD CONSTRAINT "SessionDocumentDelivery_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
